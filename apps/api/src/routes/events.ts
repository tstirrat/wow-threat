/**
 * Events Routes
 *
 * GET /reports/:code/fights/:id/events - Get events with threat calculations
 */
import {
  configCacheVersion,
  getSupportedGameVersions,
  resolveConfigOrNull,
} from '@wow-threat/config'
import { ThreatEngine, buildThreatEngineInput } from '@wow-threat/engine'
import { Hono } from 'hono'

import {
  fightNotFound,
  invalidConfigVersion,
  invalidEventsCursor,
  invalidFightId,
  invalidGameVersion,
  reportNotFound,
  unauthorized,
} from '../middleware/error'
import { CacheKeys, createCache, normalizeVisibility } from '../services/cache'
import { WCLClient } from '../services/wcl'
import type {
  AugmentedEventsResponse,
  RawFightEventsResponse,
  ReportActorRole,
} from '../types/api'
import type { Bindings, Variables } from '../types/bindings'
import {
  estimateArrayPayloadBytes,
  getUtf8ByteLength,
  logEventsMemoryCheckpoint,
  monotonicNowMs,
} from './events-logging'

export const eventsRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

const threatEngine = new ThreatEngine()
const maxCacheableAugmentedEvents = 15000

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

function shouldProcessEvents(value: string | undefined): boolean {
  if (!value) {
    return true
  }

  return !(value === '0' || value === 'false' || value === 'raw')
}

function parseEventsCursor(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!/^\d+$/.test(value)) {
    throw invalidEventsCursor(value)
  }

  return Number.parseInt(value, 10)
}

function serializeInitialAurasByActor(
  initialAurasByActor: Map<number, readonly number[]>,
): Record<string, number[]> {
  return Object.fromEntries(
    [...initialAurasByActor.entries()]
      .filter(([, auraIds]) => auraIds.length > 0)
      .map(([actorId, auraIds]) => [
        String(actorId),
        [...new Set(auraIds)].sort((left, right) => left - right),
      ]),
  )
}

/**
 * GET /reports/:code/fights/:id/events
 * Returns threat-augmented events for supported combat event types
 */
eventsRoutes.get('/', async (c) => {
  const code = c.req.param('code')!
  const idParam = c.req.param('id')!
  const configVersionParam = c.req.query('cv')
  const processParam = c.req.query('process')
  const cursorParam = c.req.query('cursor')
  const refreshParam = c.req.query('refresh')
  const inferThreatReductionParam = c.req.query('inferThreatReduction')
  const debugMemoryParam = c.req.query('debugMemory')
  const bypassAugmentedCache = isTruthyQueryParam(refreshParam)
  const inferThreatReduction = isTruthyQueryParam(inferThreatReductionParam)
  const processEvents = shouldProcessEvents(processParam)
  const cursor = parseEventsCursor(cursorParam)
  const debugMemory = isTruthyQueryParam(debugMemoryParam)
  const requestStartedAtMs = monotonicNowMs()

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
  if (configVersionParam && configVersionParam !== configCacheVersion) {
    throw invalidConfigVersion(configVersionParam, configCacheVersion)
  }
  const configVersion = configCacheVersion
  const isVersionedRequest = configVersionParam === configVersion

  const cacheControl =
    visibility === 'public'
      ? isVersionedRequest
        ? 'public, max-age=31536000, immutable'
        : c.env.ENVIRONMENT === 'development'
          ? 'no-store, no-cache, must-revalidate'
          : 'public, max-age=0, must-revalidate'
      : 'private, no-store'

  const fightFriendlyActorIds = new Set<number>([
    ...(fight.friendlyPlayers ?? []),
    ...(fight.friendlyPets ?? []).map((pet) => pet.id),
  ])

  if (!processEvents) {
    const requestStartTime = cursor ?? fight.startTime
    const [eventsPage, initialAurasByActor] = await Promise.all([
      wcl.getEventsPage(
        code,
        fightId,
        visibility,
        requestStartTime,
        fight.endTime,
        {
          bypassCache: bypassAugmentedCache,
        },
      ),
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
    const serializedInitialAurasByActor =
      serializeInitialAurasByActor(initialAurasByActor)

    logEventsMemoryCheckpoint({
      code,
      debugMemory,
      details: {
        durationMs: Math.round(monotonicNowMs() - requestStartedAtMs),
        nextPageTimestamp: eventsPage.nextPageTimestamp ?? undefined,
        rawEventCount: eventsPage.data.length,
        rawEventsEstimatedBytes: estimateArrayPayloadBytes(eventsPage.data),
        requestStartTime,
      },
      fightId,
      phase: 'raw-page-response',
    })

    const response: RawFightEventsResponse = {
      reportCode: code,
      fightId,
      fightName: fight.name,
      gameVersion,
      configVersion,
      process: 'raw',
      events: eventsPage.data,
      nextPageTimestamp: eventsPage.nextPageTimestamp,
      initialAurasByActor: serializedInitialAurasByActor,
    }

    return c.json(response, 200, {
      'Cache-Control': cacheControl,
      'X-Events-Mode': 'raw',
      'X-Game-Version': String(gameVersion),
      'X-Config-Version': configVersion,
      'X-Next-Page-Timestamp': String(eventsPage.nextPageTimestamp ?? ''),
    })
  }

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
    logEventsMemoryCheckpoint({
      code,
      debugMemory,
      details: {
        cacheStatus: 'HIT',
        durationMs: Math.round(monotonicNowMs() - requestStartedAtMs),
        initialAuraActors: Object.keys(cached.initialAurasByActor ?? {}).length,
        responseEventCount: cached.events.length,
        responseEstimatedBytes: estimateArrayPayloadBytes(cached.events),
      },
      fightId,
      phase: 'cache-hit',
    })
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

  const fightFriendlyPlayers = report.masterData.actors.flatMap((actor) =>
    actor.type === 'Player' && (fight.friendlyPlayers ?? []).includes(actor.id)
      ? [
          {
            id: actor.id,
            name: actor.name,
          },
        ]
      : [],
  )
  const friendlyPlayerRolesPromise = inferThreatReduction
    ? wcl.getFightPlayerRoles(code, fightId, visibility, fightFriendlyPlayers, {
        bypassCache: bypassAugmentedCache,
      })
    : Promise.resolve(new Map<number, ReportActorRole>())

  const [rawEvents, initialAurasByActor, friendlyPlayerRoles] =
    await Promise.all([
      wcl.getEvents(code, fightId, visibility, fight.startTime, fight.endTime, {
        bypassCache: bypassAugmentedCache,
      }),
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
      friendlyPlayerRolesPromise,
    ])
  const tankActorIds = new Set(
    [...friendlyPlayerRoles.entries()]
      .filter(([, role]) => role === 'Tank')
      .map(([actorId]) => actorId),
  )

  logEventsMemoryCheckpoint({
    code,
    debugMemory,
    details: {
      durationMs: Math.round(monotonicNowMs() - requestStartedAtMs),
      inferThreatReduction,
      initialAuraActorsBeforeProcessors: initialAurasByActor.size,
      rawEventCount: rawEvents.length,
      rawEventsEstimatedBytes: estimateArrayPayloadBytes(rawEvents),
      resolvedTankActorIds: tankActorIds.size,
    },
    fightId,
    phase: 'after-raw-fetch',
  })

  console.info('[Events] Loaded fight events and initial aura seeds', {
    code,
    fightId,
    rawEvents: rawEvents.length,
    fightFriendlyActors: fightFriendlyActorIds.size,
    fightFriendlyPlayers: fightFriendlyPlayers.length,
    inferThreatReduction,
    inferredTankActors: tankActorIds.size,
    initialAuraActorsBeforeProcessors: initialAurasByActor.size,
    initialAuraIdsBeforeProcessors: countInitialAuraIds(initialAurasByActor),
  })

  const { actorMap, friendlyActorIds, enemies, abilitySchoolMap } =
    buildThreatEngineInput({
      fight,
      actors: report.masterData.actors,
      abilities: report.masterData.abilities,
    })

  // Process events and calculate threat using the threat engine
  const { augmentedEvents, initialAurasByActor: effectiveInitialAurasByActor } =
    threatEngine.processEvents({
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
      tankActorIds,
      config,
    })
  const serializedInitialAurasByActor = serializeInitialAurasByActor(
    effectiveInitialAurasByActor,
  )
  logEventsMemoryCheckpoint({
    code,
    debugMemory,
    details: {
      augmentedEventCount: augmentedEvents.length,
      augmentedEventsEstimatedBytes: estimateArrayPayloadBytes(augmentedEvents),
      durationMs: Math.round(monotonicNowMs() - requestStartedAtMs),
      initialAuraActorsAfterProcessors: effectiveInitialAurasByActor.size,
    },
    fightId,
    phase: 'after-augmentation',
  })
  rawEvents.length = 0

  const response: AugmentedEventsResponse = {
    reportCode: code,
    fightId,
    fightName: fight.name,
    gameVersion,
    configVersion,
    process: 'processed',
    events: augmentedEvents,
    initialAurasByActor: serializedInitialAurasByActor,
  }
  const serializedResponse = JSON.stringify(response)
  const responseBytes = getUtf8ByteLength(serializedResponse)
  logEventsMemoryCheckpoint({
    code,
    debugMemory,
    details: {
      durationMs: Math.round(monotonicNowMs() - requestStartedAtMs),
      responseBytes,
      responseEventCount: response.events.length,
    },
    fightId,
    phase: 'before-response',
  })

  if (response.events.length <= maxCacheableAugmentedEvents) {
    await augmentedCache.set(cacheKey, response)
  } else {
    console.info('[Events] Skipping augmented cache for large payload', {
      code,
      fightId,
      eventCount: response.events.length,
      maxCacheableAugmentedEvents,
    })
  }

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
