/**
 * Events Routes
 *
 * GET /reports/:code/fights/:id/events - Get events with threat calculations
 */
import type {
  Actor,
  AugmentedEvent,
  Enemy,
  WowClass,
} from '@wcl-threat/threat-config'
import { getConfig } from '@wcl-threat/threat-config'
import type { WCLEvent } from '@wcl-threat/wcl-types'
import { Hono } from 'hono'

import {
  fightNotFound,
  invalidFightId,
  reportNotFound,
} from '../middleware/error'
import { CacheKeys, createCache } from '../services/cache'
import { processEvents } from '../services/threat-engine'
import { WCLClient } from '../services/wcl'
import type { Bindings, Variables } from '../types/bindings'

export const eventsRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

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

  // Build a lookup from all report actors (for name/class resolution)
  const allActors = new Map(report.masterData.actors.map((a) => [a.id, a]))

  // Helper to create an actor entry
  const createActorEntry = (
    id: number,
    actor: (typeof report.masterData.actors)[0] | undefined,
    isPlayer: boolean,
  ): [number, Actor] => {
    return [
      id,
      {
        id,
        name: actor?.name ?? 'Unknown',
        class:
          isPlayer && actor?.type === 'Player'
            ? (actor.subType.toLowerCase() as WowClass)
            : null,
      },
    ]
  }

  // Build fight-scoped actor map from friendly participants and enemies
  const friendlyPlayerEntries = (fight.friendlyPlayers ?? [])
    .map((playerId) => [playerId, allActors.get(playerId)] as const)
    .filter(([, actor]) => actor !== undefined)
    .map(([id, actor]) => createActorEntry(id, actor, true))

  const friendlyPetEntries = (fight.friendlyPets ?? [])
    .map((pet) => [pet.id, allActors.get(pet.id)] as const)
    .filter(([, actor]) => actor !== undefined)
    .map(([id, actor]) => createActorEntry(id, actor, false))

  const enemyActorEntries = [
    ...(fight.enemyNPCs ?? []),
    ...(fight.enemyPets ?? []),
  ]
    .map((npc) => [npc.id, allActors.get(npc.id)] as const)
    .filter(([, actor]) => actor !== undefined)
    .map(([id, actor]) => createActorEntry(id, actor, false))

  const actorMap = new Map([
    ...friendlyPlayerEntries,
    ...friendlyPetEntries,
    ...enemyActorEntries,
  ])

  // Build fight-scoped enemy list
  const enemies: Enemy[] = [
    ...(fight.enemyNPCs ?? []),
    ...(fight.enemyPets ?? []),
  ].map((npc) => ({
    id: npc.id,
    name: allActors.get(npc.id)?.name ?? 'Unknown',
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

export interface AugmentedEventsResponse {
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
