/**
 * Events Routes
 *
 * GET /reports/:code/fights/:id/events - Get events with threat calculations
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../types/bindings'
import type { AugmentedEvent, Enemy, Actor, WowClass } from '@wcl-threat/threat-config'
import type { WCLEvent } from '@wcl-threat/wcl-types'
import { getConfig } from '@wcl-threat/threat-config'
import { WCLClient } from '../services/wcl'
import { CacheKeys, createCache } from '../services/cache'
import { invalidFightId, reportNotFound, fightNotFound } from '../middleware/error'
import { processEvents } from '../services/threat-engine'

export const eventsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * GET /reports/:code/fights/:id/events
 * Returns all events with threat calculations
 */
eventsRoutes.get('/', async (c) => {
  const code = c.req.param('code')!
  const idParam = c.req.param('id')!
  const configVersionParam = c.req.query('configVersion')

  // Validate fight ID
  const fightId = parseInt(idParam, 10)
  if (Number.isNaN(fightId)) {
    throw invalidFightId(idParam)
  }

  const wcl = new WCLClient(c.env)

  // Get report to find game version and fight info
  const reportData = await wcl.getReport(code)
  if (!reportData?.reportData?.report) {
    throw reportNotFound(code)
  }

  const report = reportData.reportData.report
  const fight = report.fights.find((f) => f.id === fightId)
  if (!fight) {
    throw fightNotFound(code, fightId)
  }

  const gameVersion = report.masterData.gameVersion
  const config = getConfig(gameVersion)
  const configVersion = configVersionParam ?? config.version

  // Check augmented cache
  const augmentedCache = createCache(c.env, 'augmented')
  const cacheKey = CacheKeys.augmentedEvents(code, fightId, configVersion)
  const cached = await augmentedCache.get<AugmentedEventsResponse>(cacheKey)

  if (cached) {
    const cacheControl =
      c.env.ENVIRONMENT === 'development'
        ? 'no-store, no-cache, must-revalidate'
        : 'public, max-age=31536000, immutable'

    return c.json(cached, 200, {
      'Cache-Control': cacheControl,
      'X-Cache-Status': 'HIT',
      'X-Game-Version': String(gameVersion),
      'X-Config-Version': configVersion,
    })
  }

  // Fetch raw events from WCL
  const rawEvents = (await wcl.getEvents(code, fightId)) as WCLEvent[]

  // Build actor maps
  const actorMap = new Map<number, Actor>()
  for (const actor of report.masterData.actors) {
    actorMap.set(actor.id, {
      id: actor.id,
      name: actor.name,
      class: actor.type === 'Player' ? (actor.subType.toLowerCase() as WowClass) : null,
    })
  }

  // Build enemy list
  const enemies: Enemy[] = report.masterData.actors
    .filter((a) => a.type === 'NPC' || a.type === 'Boss')
    .map((a) => ({
      id: a.id,
      name: a.name,
      instance: 0,
    }))

  // Process events and calculate threat using the threat engine
  const { augmentedEvents, eventCounts } = processEvents({
    rawEvents,
    actorMap,
    enemies,
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

  // Cache the result
  await augmentedCache.set(cacheKey, response)

  const cacheControl =
    c.env.ENVIRONMENT === 'development'
      ? 'no-store, no-cache, must-revalidate'
      : 'public, max-age=31536000, immutable'

  return c.json(response, 200, {
    'Cache-Control': cacheControl,
    'X-Cache-Status': 'MISS',
    'X-Game-Version': String(gameVersion),
    'X-Config-Version': configVersion,
    ETag: `"${code}-${fightId}-${configVersion}"`,
  })
})

interface AugmentedEventsResponse {
  reportCode: string
  fightId: number
  fightName: string
  gameVersion: number
  configVersion: string
  events: AugmentedEvent[]
  summary: {
    totalEvents: number
    eventCounts: Record<string, number>
    duration: number
  }
}


