/**
 * Events Routes
 *
 * GET /reports/:code/fights/:id/events - Get events with threat calculations
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../types/bindings'
import type { WCLEvent } from '@wcl-threat/wcl-types'
import type { AugmentedEvent, Enemy, Actor, WowClass } from '@wcl-threat/threat-config'
import { getConfig, getConfigVersion } from '@wcl-threat/threat-config'
import { WCLClient } from '../services/wcl'
import { CacheKeys, createCache } from '../services/cache'
import { invalidFightId, reportNotFound, fightNotFound } from '../middleware/error'
import { calculateThreat, AuraTracker } from '../services/threat'

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
    return c.json(cached, 200, {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Cache-Status': 'HIT',
      'X-Game-Version': String(gameVersion),
      'X-Config-Version': configVersion,
    })
  }

  // Fetch raw events from WCL
  const rawEvents = await wcl.getEvents(code, fightId)

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

  // Process events and calculate threat
  const auraTracker = new AuraTracker()
  const augmentedEvents: AugmentedEvent[] = []
  const eventCounts: Record<string, number> = {}

  for (const rawEvent of rawEvents) {
    const event = rawEvent as WCLEvent

    // Track auras
    auraTracker.processEvent(event)

    // Count event types
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1

    // Calculate threat for relevant event types
    if (shouldCalculateThreat(event)) {
      const sourceActor = actorMap.get(event.sourceID) ?? {
        id: event.sourceID,
        name: 'Unknown',
        class: null,
      }
      const targetActor = actorMap.get(event.targetID) ?? {
        id: event.targetID,
        name: 'Unknown',
        class: null,
      }

      const threatResult = calculateThreat(
        event,
        {
          sourceAuras: auraTracker.getAuras(event.sourceID),
          targetAuras: auraTracker.getAuras(event.targetID),
          enemies,
          sourceActor,
          targetActor,
          encounterId: null,
        },
        config
      )

      augmentedEvents.push(buildAugmentedEvent(event, threatResult))
    }
  }

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

  return c.json(response, 200, {
    'Cache-Control': 'public, max-age=31536000, immutable',
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

/**
 * Determine if an event should have threat calculated
 */
function shouldCalculateThreat(event: WCLEvent): boolean {
  return ['damage', 'heal', 'energize', 'cast'].includes(event.type)
}

/**
 * Build an augmented event from a WCL event and threat result
 */
function buildAugmentedEvent(
  event: WCLEvent,
  threatResult: ReturnType<typeof calculateThreat>
): AugmentedEvent {
  const base: AugmentedEvent = {
    timestamp: event.timestamp,
    type: event.type,
    sourceID: event.sourceID,
    sourceIsFriendly: event.sourceIsFriendly,
    targetID: event.targetID,
    targetIsFriendly: event.targetIsFriendly,
    sourceInstance: event.sourceInstance,
    targetInstance: event.targetInstance,
    threat: threatResult,
  }

  // Add event-specific fields
  if ('ability' in event) {
    base.ability = event.ability
  }
  if ('amount' in event) {
    base.amount = event.amount
  }
  if ('absorbed' in event) {
    base.absorbed = event.absorbed
  }
  if ('blocked' in event) {
    base.blocked = event.blocked
  }
  if ('mitigated' in event) {
    base.mitigated = event.mitigated
  }
  if ('overkill' in event) {
    base.overkill = event.overkill
  }
  if ('overheal' in event) {
    base.overheal = event.overheal
  }
  if ('hitType' in event) {
    base.hitType = event.hitType
  }
  if ('tick' in event) {
    base.tick = event.tick
  }

  return base
}
