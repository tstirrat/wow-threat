/**
 * Events Routes
 *
 * GET /reports/:code/fights/:id/events - Get events with threat calculations
 */
import {
  getSupportedGameVersions,
  resolveConfigOrNull,
} from '@wow-threat/config'
import { buildThreatEngineInput, processEvents } from '@wow-threat/engine'
import type { Report, WCLEvent } from '@wow-threat/wcl-types'
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
import { WCLClient, resolveFightTankActorIds } from '../services/wcl'
import type { AugmentedEventsResponse } from '../types/api'
import type { Bindings, Variables } from '../types/bindings'

export const eventsRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

const BLESSING_OF_SALVATION_ID = 1038
const GREATER_BLESSING_OF_SALVATION_ID = 25895
const TRANQUIL_AIR_TOTEM_ID = 25909

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

function parseActorIdListQueryParam(value: string | undefined): number[] | null {
  if (value === undefined) {
    return null
  }

  const parsedActorIds = value
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part) && part > 0)

  return [...new Set(parsedActorIds)].sort((left, right) => left - right)
}

function resolveFightThreatReductionBaselineAuraId({
  report,
  friendlyPlayerIds,
}: {
  report: Report
  friendlyPlayerIds: Set<number>
}): number | null {
  let hasPaladin = false
  let hasShaman = false

  report.masterData.actors.forEach((actor) => {
    if (
      actor.type !== 'Player' ||
      !friendlyPlayerIds.has(actor.id) ||
      (hasPaladin && hasShaman)
    ) {
      return
    }

    if (actor.subType === 'Paladin') {
      hasPaladin = true
      return
    }

    if (actor.subType === 'Shaman') {
      hasShaman = true
    }
  })

  if (hasPaladin) {
    return GREATER_BLESSING_OF_SALVATION_ID
  }

  if (hasShaman) {
    return TRANQUIL_AIR_TOTEM_ID
  }

  return null
}

function normalizeTankActorIdsSegment(tankActorIds: readonly number[] | null): string {
  if (tankActorIds === null) {
    return 'auto'
  }

  if (tankActorIds.length === 0) {
    return 'none'
  }

  return tankActorIds.join('-')
}

function inferFightThreatReductionAuras({
  rawEvents,
  initialAurasByActor,
  friendlyPlayerIds,
  tankActorIds,
  baselineAuraId,
}: {
  rawEvents: WCLEvent[]
  initialAurasByActor: Map<number, number[]>
  friendlyPlayerIds: Set<number>
  tankActorIds: Set<number>
  baselineAuraId: number
}): Map<number, number[]> {
  if (friendlyPlayerIds.size === 0) {
    return initialAurasByActor
  }

  const combatantInfoMinorSalvationPlayerIds = new Set<number>()
  const minorSalvationRemovedPlayerIds = new Set<number>()

  rawEvents.forEach((event) => {
    if (
      event.type === 'combatantinfo' &&
      friendlyPlayerIds.has(event.sourceID) &&
      (event.auras ?? []).some(
        (aura) => aura.ability === BLESSING_OF_SALVATION_ID,
      )
    ) {
      combatantInfoMinorSalvationPlayerIds.add(event.sourceID)
      return
    }

    if (
      event.type === 'removebuff' &&
      event.abilityGameID === BLESSING_OF_SALVATION_ID &&
      friendlyPlayerIds.has(event.targetID)
    ) {
      minorSalvationRemovedPlayerIds.add(event.targetID)
    }
  })
  const inferredAurasByActor = new Map<number, number[]>(initialAurasByActor)

  friendlyPlayerIds.forEach((actorId) => {
    if (tankActorIds.has(actorId)) {
      return
    }

    const actorAuraIds = new Set(inferredAurasByActor.get(actorId) ?? [])
    const hasInitialMinorSalvation =
      actorAuraIds.has(BLESSING_OF_SALVATION_ID) ||
      combatantInfoMinorSalvationPlayerIds.has(actorId)
    const hasMinorSalvationRemoval = minorSalvationRemovedPlayerIds.has(actorId)

    const inferredAuraId =
      hasMinorSalvationRemoval && !hasInitialMinorSalvation
        ? BLESSING_OF_SALVATION_ID
        : baselineAuraId === GREATER_BLESSING_OF_SALVATION_ID &&
            hasInitialMinorSalvation
          ? null
          : baselineAuraId

    if (inferredAuraId === null || actorAuraIds.has(inferredAuraId)) {
      return
    }

    actorAuraIds.add(inferredAuraId)

    inferredAurasByActor.set(
      actorId,
      [...actorAuraIds].sort((left, right) => left - right),
    )
  })

  return inferredAurasByActor
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
  const tankActorIdsParam = c.req.query('tankActorIds')
  const bypassAugmentedCache = isTruthyQueryParam(refreshParam)
  const inferThreatReduction = isTruthyQueryParam(inferThreatReductionParam)
  const requestedTankActorIds = parseActorIdListQueryParam(tankActorIdsParam)

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
    inferThreatReduction ? requestedTankActorIds : null,
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
  const friendlyPlayerIds = new Set<number>(fight.friendlyPlayers ?? [])
  const baselineAuraId = inferThreatReduction
    ? resolveFightThreatReductionBaselineAuraId({
        report,
        friendlyPlayerIds,
      })
    : null
  const shouldInferThreatReductionAuras =
    inferThreatReduction &&
    baselineAuraId !== null &&
    friendlyPlayerIds.size > 0
  const tankActorIds = new Set<number>()

  if (shouldInferThreatReductionAuras) {
    if (requestedTankActorIds !== null) {
      requestedTankActorIds.forEach((actorId) => {
        if (friendlyPlayerIds.has(actorId)) {
          tankActorIds.add(actorId)
        }
      })
    } else {
      const friendlyPlayers = report.masterData.actors.flatMap((actor) =>
        actor.type === 'Player' && friendlyPlayerIds.has(actor.id)
          ? [
              {
                id: actor.id,
                name: actor.name,
              },
            ]
          : [],
      )
      const encounterActorRoles = await wcl.getEncounterActorRoles(
        code,
        fight.encounterID ?? null,
        fight.id,
        visibility,
        friendlyPlayers,
        {
          bypassCache: bypassAugmentedCache,
        },
      )
      const resolvedTankActorIds = new Set<number>([
        ...resolveFightTankActorIds(report, fightId),
        ...[...encounterActorRoles.entries()].flatMap(([actorId, role]) =>
          role === 'Tank' ? [actorId] : [],
        ),
      ])
      resolvedTankActorIds.forEach((actorId) => {
        if (friendlyPlayerIds.has(actorId)) {
          tankActorIds.add(actorId)
        }
      })
    }
  }

  const effectiveInitialAurasByActor =
    shouldInferThreatReductionAuras && baselineAuraId !== null
    ? inferFightThreatReductionAuras({
        rawEvents,
        initialAurasByActor,
        friendlyPlayerIds,
        tankActorIds,
        baselineAuraId,
      })
    : initialAurasByActor

  console.info('[Events] Loaded fight events and initial aura seeds', {
    code,
    fightId,
    rawEvents: rawEvents.length,
    fightFriendlyActors: fightFriendlyActorIds.size,
    inferThreatReduction,
    inferenceBaselineAuraId: baselineAuraId,
    tankActorIdSource:
      requestedTankActorIds === null ? 'encounter-rankings' : 'request',
    requestedTankActorIds:
      requestedTankActorIds === null
        ? null
        : normalizeTankActorIdsSegment(requestedTankActorIds),
    inferredTankActors: tankActorIds.size,
    initialAuraActors: effectiveInitialAurasByActor.size,
    initialAuraIds: countInitialAuraIds(effectiveInitialAurasByActor),
  })

  const { actorMap, friendlyActorIds, enemies, abilitySchoolMap } =
    buildThreatEngineInput({
      fight,
      actors: report.masterData.actors,
      abilities: report.masterData.abilities,
      rawEvents,
    })

  // Process events and calculate threat using the threat engine
  const { augmentedEvents, eventCounts } = processEvents({
    rawEvents,
    initialAurasByActor: effectiveInitialAurasByActor,
    actorMap,
    friendlyActorIds,
    abilitySchoolMap,
    enemies,
    encounterId: fight.encounterID ?? null,
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
      ETag: `"${code}-${fightId}-${configVersion}-${inferThreatReduction ? `infer-${normalizeTankActorIdsSegment(requestedTankActorIds)}` : 'standard'}"`,
    },
    status: 200,
  })
})

export type { AugmentedEventsResponse } from '../types/api'
