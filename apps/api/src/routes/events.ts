/**
 * Events Routes
 *
 * GET /reports/:code/fights/:id/events - Get events with threat calculations
 */
import type {
  Actor,
  Enemy,
  WowClass,
} from '@wcl-threat/threat-config'
import { getConfig } from '@wcl-threat/threat-config'
import type { WCLEvent } from '@wcl-threat/wcl-types'
import { Hono } from 'hono'

import {
  fightNotFound,
  invalidConfigVersion,
  invalidFightId,
  reportNotFound,
} from '../middleware/error'
import { CacheKeys, createCache } from '../services/cache'
import { processEvents } from '../services/threat-engine'
import { WCLClient } from '../services/wcl'
import type { AugmentedEventsResponse } from '../types/api'
import type { Bindings, Variables } from '../types/bindings'

export const eventsRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

/**
 * Parse a WCL ability type string into a numeric school bitmask.
 * Examples:
 * - '1' -> 1 (Physical)
 * - '2' -> 2 (Holy)
 * - '20' -> 20 (Fire + Frost)
 * - null/invalid -> 0 (unknown)
 */
function parseAbilitySchoolMask(type: string | null): number {
  if (!type) {
    return 0
  }

  const mask = Number.parseInt(type, 10)
  if (!Number.isFinite(mask)) {
    return 0
  }

  return mask
}

function buildAbilitySchoolMap(
  abilities: Array<{ gameID: number | null; type: string | null }> | undefined,
): Map<number, number> {
  const map = new Map<number, number>()

  for (const ability of abilities ?? []) {
    if (ability.gameID === null || !Number.isFinite(ability.gameID)) {
      continue
    }

    const abilityId = Math.trunc(ability.gameID)
    map.set(abilityId, parseAbilitySchoolMask(ability.type))
  }

  return map
}

/**
 * GET /reports/:code/fights/:id/events
 * Returns threat-augmented events for supported combat event types
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
  if (configVersionParam && configVersionParam !== config.version) {
    throw invalidConfigVersion(configVersionParam, config.version)
  }
  const configVersion = config.version

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

  // Build fight-scoped enemy list keyed by enemy id + instance.
  // We seed each enemy with instance 0, then add observed instances from event payloads.
  const enemyIds = new Set(
    [...(fight.enemyNPCs ?? []), ...(fight.enemyPets ?? [])].map((enemy) => enemy.id),
  )
  const enemyInstanceKeys = new Set<string>(
    [...enemyIds].map((enemyId) => `${enemyId}:0`),
  )

  for (const event of rawEvents) {
    if (enemyIds.has(event.sourceID)) {
      enemyInstanceKeys.add(`${event.sourceID}:${event.sourceInstance ?? 0}`)
    }
    if (enemyIds.has(event.targetID)) {
      enemyInstanceKeys.add(`${event.targetID}:${event.targetInstance ?? 0}`)
    }
  }

  const enemies: Enemy[] = [...enemyInstanceKeys]
    .map((key) => {
      const [idRaw, instanceRaw] = key.split(':')
      const id = Number(idRaw)
      const instance = Number(instanceRaw)

      return {
        id,
        name: allActors.get(id)?.name ?? 'Unknown',
        instance,
      }
    })
    .sort((a, b) => {
      if (a.id === b.id) {
        return a.instance - b.instance
      }
      return a.id - b.id
    })

  const abilitySchoolMap = buildAbilitySchoolMap(report.masterData.abilities)

  // Process events and calculate threat using the threat engine
  const { augmentedEvents, eventCounts } = processEvents({
    rawEvents,
    actorMap,
    abilitySchoolMap,
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

export type { AugmentedEventsResponse } from '../types/api'
