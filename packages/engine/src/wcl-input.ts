/**
 * WCL Input Builders
 *
 * Utilities for converting report/fight payloads into Threat Engine input
 * structures.
 */
import type { Actor, Enemy, WowClass } from '@wow-threat/shared'
import type {
  ReportAbility,
  ReportActor,
  ReportFight,
} from '@wow-threat/wcl-types'

export interface BuildThreatEngineInput {
  actorMap: Map<number, Actor>
  friendlyActorIds: Set<number>
  enemies: Enemy[]
  abilitySchoolMap: Map<number, number>
}

export interface BuildThreatEngineInputParams {
  fight: ReportFight
  actors: ReportActor[]
  abilities?: ReportAbility[]
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
      petOwner: actor?.type === 'Pet' ? (actor.petOwner ?? null) : undefined,
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

function buildFriendlyActorIds(fight: ReportFight): Set<number> {
  const friendlyPlayerIds = fight.friendlyPlayers ?? []
  const friendlyPetIds = (fight.friendlyPets ?? []).map((pet) => pet.id)

  return new Set([...friendlyPlayerIds, ...friendlyPetIds])
}

function buildEnemies(fight: ReportFight, actors: ReportActor[]): Enemy[] {
  const allActors = new Map(actors.map((actor) => [actor.id, actor]))
  const enemyById = [
    ...(fight.enemyNPCs ?? []),
    ...(fight.enemyPets ?? []),
  ].reduce(
    (result, enemy) => {
      const actor = allActors.get(enemy.id)
      const nextInstanceCount = Math.max(1, Math.trunc(enemy.instanceCount))
      const current = result.get(enemy.id)

      result.set(enemy.id, {
        id: enemy.id,
        name: actor?.name ?? current?.name ?? 'Unknown',
        gameID: enemy.gameID ?? actor?.gameID ?? current?.gameID,
        instanceCount: Math.max(current?.instanceCount ?? 0, nextInstanceCount),
      })
      return result
    },
    new Map<
      number,
      {
        id: number
        name: string
        gameID?: number
        instanceCount: number
      }
    >(),
  )

  return [...enemyById.values()]
    .flatMap((enemy) =>
      Array.from({ length: enemy.instanceCount }, (_, instance) => ({
        id: enemy.id,
        name: enemy.name,
        gameID: enemy.gameID,
        instance,
      })),
    )
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
  const { fight, actors, abilities } = params

  return {
    actorMap: buildActorMap(fight, actors),
    friendlyActorIds: buildFriendlyActorIds(fight),
    enemies: buildEnemies(fight, actors),
    abilitySchoolMap: buildAbilitySchoolMap(abilities),
  }
}
