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

/**
 * GET /reports/:code/fights/:id/events
 * Returns threat-augmented events for supported combat event types
 */
eventsRoutes.get('/', async (c) => {
  const code = c.req.param('code')!
  const idParam = c.req.param('id')!
  const configVersionParam = c.req.query('configVersion')
  const refreshParam = c.req.query('refresh')
  const bypassAugmentedCache = refreshParam === '1' || refreshParam === 'true'

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

  // Check augmented cache
  const augmentedCache = createCache(c.env, 'augmented')
  const cacheKey = CacheKeys.augmentedEvents(
    code,
    fightId,
    configVersion,
    visibility,
    visibility === 'private' ? uid : undefined,
  )
  const cached = bypassAugmentedCache
    ? null
    : await augmentedCache.get<AugmentedEventsResponse>(cacheKey)

  if (cached) {
    const cacheControl =
      c.env.ENVIRONMENT === 'development'
        ? 'no-store, no-cache, must-revalidate'
        : visibility === 'public'
          ? 'public, max-age=31536000, immutable'
          : 'private, no-store'

    return c.json(cached, 200, {
      'Cache-Control': cacheControl,
      'X-Cache-Status': 'HIT',
      'X-Game-Version': String(gameVersion),
      'X-Config-Version': configVersion,
    })
  }

  // Fetch raw events from WCL
  const rawEvents = (await wcl.getEvents(
    code,
    fightId,
    visibility,
    fight.startTime,
    fight.endTime,
    {
      bypassCache: bypassAugmentedCache,
    },
  )) as WCLEvent[]

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
    actorMap,
    friendlyActorIds,
    abilitySchoolMap,
    enemies,
    encounterId: fight.encounterID ?? null,
    config,
  })

  const response: AugmentedEventsResponse = {
    reportCode: code,
    fightId,
    fightName: fight.name,
    gameVersion,
    configVersion,
    events: augmentedEvents,
    summary: {
      totalEvents: augmentedEvents.length,
      eventCounts,
      duration: fight.endTime - fight.startTime,
    },
  }
  const serializedResponse = JSON.stringify(response)

  // Cache the result
  if (augmentedCache.type === 'kv') {
    await c.env.AUGMENTED_CACHE.put(cacheKey, serializedResponse)
  } else {
    await augmentedCache.set(cacheKey, response)
  }

  const cacheControl =
    c.env.ENVIRONMENT === 'development'
      ? 'no-store, no-cache, must-revalidate'
      : visibility === 'public'
        ? 'public, max-age=31536000, immutable'
        : 'private, no-store'

  return new Response(serializedResponse, {
    headers: {
      'Cache-Control': cacheControl,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Cache-Status': 'MISS',
      'X-Game-Version': String(gameVersion),
      'X-Config-Version': configVersion,
      ETag: `"${code}-${fightId}-${configVersion}"`,
    },
    status: 200,
  })
})

export type { AugmentedEventsResponse } from '../types/api'
