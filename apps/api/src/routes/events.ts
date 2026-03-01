/**
 * Events Routes
 *
 * GET /reports/:code/fights/:id/events - Get one raw event page passthrough
 */
import {
  configCacheVersion,
  getSupportedGameVersions,
  resolveConfigOrNull,
} from '@wow-threat/config'
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
import { normalizeVisibility } from '../services/cache'
import { WCLClient } from '../services/wcl'
import type { FightEventsResponse } from '../types/api'
import type { Bindings, Variables } from '../types/bindings'
import {
  estimateArrayPayloadBytes,
  logEventsMemoryCheckpoint,
  monotonicNowMs,
} from './events-logging'

export const eventsRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

function isTruthyQueryParam(value: string | undefined): boolean {
  return value === '1' || value === 'true'
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

function countSerializedInitialAuraIds(
  initialAurasByActor: Record<string, number[]>,
): number {
  return Object.values(initialAurasByActor).reduce(
    (totalAuraIds, auraIds) => totalAuraIds + auraIds.length,
    0,
  )
}

/**
 * GET /reports/:code/fights/:id/events
 * Returns raw WCL events page passthrough plus paging metadata.
 */
eventsRoutes.get('/', async (c) => {
  const code = c.req.param('code')!
  const idParam = c.req.param('id')!
  const configVersionParam = c.req.query('cv')
  const cursorParam = c.req.query('cursor')
  const refreshParam = c.req.query('refresh')
  const debugMemoryParam = c.req.query('debugMemory')
  const bypassRawCache = isTruthyQueryParam(refreshParam)
  const cursor = parseEventsCursor(cursorParam)
  const debugMemory = isTruthyQueryParam(debugMemoryParam)
  const requestStartedAtMs = monotonicNowMs()

  const fightId = parseInt(idParam, 10)
  if (Number.isNaN(fightId)) {
    throw invalidFightId(idParam)
  }

  const uid = c.get('uid')
  if (!uid) {
    throw unauthorized('Missing authenticated uid context')
  }

  const wcl = new WCLClient(c.env, uid)

  const reportData = await wcl.getReport(code)
  if (!reportData?.reportData?.report) {
    throw reportNotFound(code)
  }

  const report = reportData.reportData.report
  const visibility = normalizeVisibility(report.visibility)
  const fight = report.fights.find(
    (candidateFight) => candidateFight.id === fightId,
  )
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
  const isVersionedRequest = configVersionParam === configCacheVersion

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
  const requestStartTime = cursor ?? fight.startTime

  const [eventsPage, initialAurasByActor] = await Promise.all([
    wcl.getEventsPage(
      code,
      fightId,
      visibility,
      requestStartTime,
      fight.endTime,
      {
        bypassCache: bypassRawCache,
      },
    ),
    wcl.getFriendlyBuffAurasAtFightStart(
      code,
      fightId,
      visibility,
      fight.startTime,
      fightFriendlyActorIds,
      {
        bypassCache: bypassRawCache,
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
      initialAuraActors: Object.keys(serializedInitialAurasByActor).length,
      initialAuraIds: countSerializedInitialAuraIds(
        serializedInitialAurasByActor,
      ),
      nextPageTimestamp: eventsPage.nextPageTimestamp ?? undefined,
      rawEventCount: eventsPage.data.length,
      rawEventsEstimatedBytes: estimateArrayPayloadBytes(eventsPage.data),
      requestStartTime,
    },
    fightId,
    phase: 'raw-page-response',
  })

  const response: FightEventsResponse = {
    reportCode: code,
    fightId,
    fightName: fight.name,
    gameVersion,
    configVersion: configCacheVersion,
    events: eventsPage.data,
    nextPageTimestamp: eventsPage.nextPageTimestamp,
    initialAurasByActor: serializedInitialAurasByActor,
  }

  return c.json(response, 200, {
    'Cache-Control': cacheControl,
    'X-Events-Mode': 'raw',
    'X-Game-Version': String(gameVersion),
    'X-Config-Version': configCacheVersion,
    'X-Next-Page-Timestamp': String(eventsPage.nextPageTimestamp ?? ''),
  })
})
