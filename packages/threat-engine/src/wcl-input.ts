/**
 * WCL Input Builders
 *
 * Utilities for converting report/fight payloads into Threat Engine input
 * structures.
 */
import type { Actor, Enemy, WowClass } from '@wcl-threat/shared'
import type {
  ReportAbility,
  ReportActor,
  ReportFight,
  WCLEvent,
} from '@wcl-threat/wcl-types'

export interface BuildThreatEngineInput {
  actorMap: Map<number, Actor>
  enemies: Enemy[]
  abilitySchoolMap: Map<number, number>
}

export interface BuildThreatEngineInputParams {
  fight: ReportFight
  actors: ReportActor[]
  abilities?: ReportAbility[]
  rawEvents: WCLEvent[]
}

const PLAYER_CLASS_NORMALIZATION: Record<string, WowClass> = {
  warrior: 'warrior',
  paladin: 'paladin',
  hunter: 'hunter',
  rogue: 'rogue',
  priest: 'priest',
  shaman: 'shaman',
  mage: 'mage',
  warlock: 'warlock',
  druid: 'druid',
  'death knight': 'deathknight',
  monk: 'monk',
  'demon hunter': 'demonhunter',
  evoker: 'evoker',
}

function normalizeWowClass(value: string): WowClass | null {
  return PLAYER_CLASS_NORMALIZATION[value.toLowerCase()] ?? null
}

function createActorEntry(
  id: number,
  actor: ReportActor | undefined,
  isPlayer: boolean,
): [number, Actor] {
  return [
    id,
    {
      id,
      name: actor?.name ?? 'Unknown',
      class:
        isPlayer && actor?.type === 'Player' && actor.subType
          ? normalizeWowClass(actor.subType)
          : null,
    },
  ]
}

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
  abilities: ReportAbility[] | undefined,
): Map<number, number> {
  return new Map(
    (abilities ?? [])
      .filter(
        (ability) => ability.gameID !== null && Number.isFinite(ability.gameID),
      )
      .map((ability) => {
        const abilityId = Math.trunc(ability.gameID!)
        return [abilityId, parseAbilitySchoolMask(ability.type)]
      }),
  )
}

function buildActorMap(
  fight: ReportFight,
  actors: ReportActor[],
): Map<number, Actor> {
  const allActors = new Map(actors.map((actor) => [actor.id, actor]))

  const friendlyPlayerEntries = (fight.friendlyPlayers ?? [])
    .map((playerId) => [playerId, allActors.get(playerId)] as const)
    .filter(([, actor]) => actor !== undefined)
    .map(([id, actor]) => createActorEntry(id, actor, true))

  const friendlyPetEntries = (fight.friendlyPets ?? [])
    .map((pet) => [pet.id, allActors.get(pet.id)] as const)
    .filter(([, actor]) => actor !== undefined)
    .map(([id, actor]) => createActorEntry(id, actor, false))

  const enemyEntries = [...(fight.enemyNPCs ?? []), ...(fight.enemyPets ?? [])]
    .map((enemy) => [enemy.id, allActors.get(enemy.id)] as const)
    .filter(([, actor]) => actor !== undefined)
    .map(([id, actor]) => createActorEntry(id, actor, false))

  return new Map([
    ...friendlyPlayerEntries,
    ...friendlyPetEntries,
    ...enemyEntries,
  ])
}

function buildEnemies(
  fight: ReportFight,
  actors: ReportActor[],
  rawEvents: WCLEvent[],
): Enemy[] {
  const allActors = new Map(actors.map((actor) => [actor.id, actor]))
  const enemyIds = new Set(
    [...(fight.enemyNPCs ?? []), ...(fight.enemyPets ?? [])].map(
      (enemy) => enemy.id,
    ),
  )

  const enemyInstanceKeys = rawEvents.reduce(
    (keys, event) => {
      if (enemyIds.has(event.sourceID)) {
        keys.add(`${event.sourceID}:${event.sourceInstance ?? 0}`)
      }
      if (enemyIds.has(event.targetID)) {
        keys.add(`${event.targetID}:${event.targetInstance ?? 0}`)
      }
      return keys
    },
    new Set([...enemyIds].map((enemyId) => `${enemyId}:0`)),
  )

  return [...enemyInstanceKeys]
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
}

/**
 * Build actor map, enemies, and ability-school lookup for `processEvents`.
 */
export function buildThreatEngineInput(
  params: BuildThreatEngineInputParams,
): BuildThreatEngineInput {
  const { fight, actors, abilities, rawEvents } = params

  return {
    actorMap: buildActorMap(fight, actors),
    enemies: buildEnemies(fight, actors, rawEvents),
    abilitySchoolMap: buildAbilitySchoolMap(abilities),
  }
}
