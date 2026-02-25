/**
 * Events Routes
 *
 * GET /reports/:code/fights/:id/events - Get events with threat calculations
 */
import {
  getSupportedGameVersions,
  resolveConfigOrNull,
} from '@wow-threat/config'
import { ThreatEngine, buildThreatEngineInput } from '@wow-threat/engine'
import type { WCLEvent } from '@wow-threat/wcl-types'
import { Hono } from 'hono'

import {
  fightNotFound,
  invalidConfigVersion,
  invalidFightId,
  invalidGameVersion,
  reportNotFound,
  unauthorized,
} from '../middleware/error'
import { CacheKeys, createCache, normalizeVisibility } from '../services/cache'
import { WCLClient } from '../services/wcl'
import type { AugmentedEventsResponse } from '../types/api'
import type { Bindings, Variables } from '../types/bindings'

export const eventsRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

const threatEngine = new ThreatEngine()

function countSerializedInitialAuraIds(
  initialAurasByActor: Record<string, number[]> | undefined,
): number {
  if (!initialAurasByActor) {
    return 0
  }

  return Object.values(initialAurasByActor).reduce(
    (totalAuraIds, auraIds) => totalAuraIds + auraIds.length,
    0,
  )
}

function countInitialAuraIds(
  initialAurasByActor: Map<number, readonly number[]>,
): number {
  return [...initialAurasByActor.values()].reduce(
    (totalAuraIds, auraIds) => totalAuraIds + auraIds.length,
    0,
  )
}

function isTruthyQueryParam(value: string | undefined): boolean {
  return value === '1' || value === 'true'
}

/**
 * GET /reports/:code/fights/:id/events
 * Returns threat-augmented events for supported combat event types
 */
eventsRoutes.get('/', async (c) => {
  const code = c.req.param('code')!
  const idParam = c.req.param('id')!
  const configVersionParam = c.req.query('configVersion')
  const refreshParam = c.req.query('refresh')
  const inferThreatReductionParam = c.req.query('inferThreatReduction')
  const bypassAugmentedCache = isTruthyQueryParam(refreshParam)
  const inferThreatReduction = isTruthyQueryParam(inferThreatReductionParam)

  // Validate fight ID
  const fightId = parseInt(idParam, 10)
  if (Number.isNaN(fightId)) {
    throw invalidFightId(idParam)
  }

  const uid = c.get('uid')
  if (!uid) {
    throw unauthorized('Missing authenticated uid context')
  }

  const wcl = new WCLClient(c.env, uid)

  // Get report to find game version and fight info
  const reportData = await wcl.getReport(code)
  if (!reportData?.reportData?.report) {
    throw reportNotFound(code)
  }

  const report = reportData.reportData.report
  const visibility = normalizeVisibility(report.visibility)
  const fight = report.fights.find((f) => f.id === fightId)
  if (!fight) {
    throw fightNotFound(code, fightId)
  }

  const gameVersion = report.masterData.gameVersion
  const config = resolveConfigOrNull({
    report,
  })
  if (!config) {
    const classicSeasonIds = Array.from(
      new Set(
        report.fights
          .map((reportFight) => reportFight.classicSeasonID)
          .filter((seasonId): seasonId is number => seasonId != null),
      ),
    )

    throw invalidGameVersion(gameVersion, getSupportedGameVersions(), {
      classicSeasonIds,
      partitionNames: (report.zone.partitions ?? []).map(
        (partition) => partition.name,
      ),
    })
  }
  if (configVersionParam && configVersionParam !== config.version) {
    throw invalidConfigVersion(configVersionParam, config.version)
  }
  const configVersion = config.version
  const isVersionedRequest = configVersionParam === configVersion

  const cacheControl =
    c.env.ENVIRONMENT === 'development'
      ? 'no-store, no-cache, must-revalidate'
      : visibility === 'public'
        ? isVersionedRequest
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, must-revalidate'
        : 'private, no-store'

  // Check augmented cache
  const augmentedCache = createCache(c.env, 'augmented')
  const cacheKey = CacheKeys.augmentedEvents(
    code,
    fightId,
    configVersion,
    inferThreatReduction,
    visibility,
    visibility === 'private' ? uid : undefined,
  )
  const cached = bypassAugmentedCache
    ? null
    : await augmentedCache.get<AugmentedEventsResponse>(cacheKey)

  if (cached) {
    const serializedInitialAuras = cached.initialAurasByActor ?? {}
    console.info('[Events] Returning augmented cache hit', {
      code,
      fightId,
      buffBandFetchSkipped: true,
      cachedInitialAuraActors: Object.keys(serializedInitialAuras).length,
      cachedInitialAuraIds: countSerializedInitialAuraIds(
        serializedInitialAuras,
      ),
    })
    return c.json(cached, 200, {
      'Cache-Control': cacheControl,
      'X-Cache-Status': 'HIT',
      'X-Game-Version': String(gameVersion),
      'X-Config-Version': configVersion,
    })
  }

  const fightFriendlyActorIds = new Set<number>([
    ...(fight.friendlyPlayers ?? []),
    ...(fight.friendlyPets ?? []).map((pet) => pet.id),
  ])

  const [rawEvents, initialAurasByActor] = await Promise.all([
    wcl.getEvents(code, fightId, visibility, fight.startTime, fight.endTime, {
      bypassCache: bypassAugmentedCache,
    }) as Promise<WCLEvent[]>,
    wcl.getFriendlyBuffAurasAtFightStart(
      code,
      fightId,
      visibility,
      fight.startTime,
      fightFriendlyActorIds,
      {
        bypassCache: bypassAugmentedCache,
      },
    ),
  ])

  console.info('[Events] Loaded fight events and initial aura seeds', {
    code,
    fightId,
    rawEvents: rawEvents.length,
    fightFriendlyActors: fightFriendlyActorIds.size,
    inferThreatReduction,
    initialAuraActorsBeforeProcessors: initialAurasByActor.size,
    initialAuraIdsBeforeProcessors: countInitialAuraIds(initialAurasByActor),
  })

  const { actorMap, friendlyActorIds, enemies, abilitySchoolMap } =
    buildThreatEngineInput({
      fight,
      actors: report.masterData.actors,
      abilities: report.masterData.abilities,
      rawEvents,
    })

  // Process events and calculate threat using the threat engine
  const {
    augmentedEvents,
    eventCounts,
    initialAurasByActor: effectiveInitialAurasByActor,
  } = threatEngine.processEvents({
    rawEvents,
    initialAurasByActor,
    actorMap,
    friendlyActorIds,
    abilitySchoolMap,
    enemies,
    encounterId: fight.encounterID ?? null,
    report,
    fight,
    inferThreatReduction,
    config,
  })
  const serializedInitialAurasByActor = Object.fromEntries(
    [...effectiveInitialAurasByActor.entries()]
      .filter(([, auraIds]) => auraIds.length > 0)
      .map(([actorId, auraIds]) => [
        String(actorId),
        [...new Set(auraIds)].sort((left, right) => left - right),
      ]),
  )

  const response: AugmentedEventsResponse = {
    reportCode: code,
    fightId,
    fightName: fight.name,
    gameVersion,
    configVersion,
    events: augmentedEvents,
    initialAurasByActor: serializedInitialAurasByActor,
    summary: {
      totalEvents: augmentedEvents.length,
      eventCounts,
      duration: fight.endTime - fight.startTime,
    },
  }
  const serializedResponse = JSON.stringify(response)

  // Cache the result
  await augmentedCache.set(cacheKey, response)

  return new Response(serializedResponse, {
    headers: {
      'Cache-Control': cacheControl,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Cache-Status': 'MISS',
      'X-Game-Version': String(gameVersion),
      'X-Config-Version': configVersion,
      ETag: `"${code}-${fightId}-${configVersion}-${inferThreatReduction ? 'infer' : 'standard'}"`,
    },
    status: 200,
  })
})

export type { AugmentedEventsResponse } from '../types/api'
