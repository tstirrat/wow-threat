/**
 * Fight navigation grouping helpers for report-level navigation lists.
 */
import type { ThreatConfigId } from '@wow-threat/config'

import type { ReportActorSummary, ReportFightSummary } from '../types/api'

type BossFightSummary = ReportFightSummary

export interface BossEncounterNavigationRow {
  encounterID: number | null
  encounterKey: string
  name: string
  primaryKill: BossFightSummary
  extraKills: BossFightSummary[]
  wipes: BossFightSummary[]
}

export interface FightBossTarget {
  id: number
  name: string
}

export interface FightNavigationGroups {
  bossEncounters: BossEncounterNavigationRow[]
  trashFights: ReportFightSummary[]
}

const unresolvedFightOrder = Number.MAX_SAFE_INTEGER

export const isBossFightForNavigation = (
  fight: ReportFightSummary,
): fight is BossFightSummary =>
  (typeof fight.encounterID === 'number' && fight.encounterID > 0) ||
  fight.bossPercentage !== null ||
  fight.fightPercentage !== null

export const normalizeEncounterNameForNavigation = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ')

const resolveEncounterId = (fight: ReportFightSummary): number | null =>
  typeof fight.encounterID === 'number' && fight.encounterID > 0
    ? fight.encounterID
    : null

const resolveFightOrder = (
  fight: ReportFightSummary,
  fightOrder: Map<number, number>,
): number => fightOrder.get(fight.id) ?? unresolvedFightOrder

const compareByFightOrder = (
  left: ReportFightSummary,
  right: ReportFightSummary,
  fightOrder: Map<number, number>,
): number => {
  const leftOrder = resolveFightOrder(left, fightOrder)
  const rightOrder = resolveFightOrder(right, fightOrder)

  return leftOrder - rightOrder
}

/** Return boss kill fights in the same order they appear in the report timeline. */
export function buildBossKillNavigationFights(
  fights: ReportFightSummary[],
): BossFightSummary[] {
  const fightOrder = new Map(fights.map((fight, index) => [fight.id, index]))

  const knownBossNames = new Set(
    fights
      .filter(isBossFightForNavigation)
      .map((fight) => normalizeEncounterNameForNavigation(fight.name)),
  )

  const isBossFightFromKnownEncounterName = (
    fight: ReportFightSummary,
  ): boolean =>
    knownBossNames.has(normalizeEncounterNameForNavigation(fight.name))

  return fights
    .filter(
      (fight) =>
        fight.kill &&
        (isBossFightForNavigation(fight) ||
          isBossFightFromKnownEncounterName(fight)),
    )
    .sort((left, right) => compareByFightOrder(left, right, fightOrder))
}

/** Return every boss pull (kills and wipes) in report timeline order. */
export function buildBossPullNavigationFights(
  fights: ReportFightSummary[],
): BossFightSummary[] {
  const knownBossNames = new Set(
    fights
      .filter(isBossFightForNavigation)
      .map((fight) => normalizeEncounterNameForNavigation(fight.name)),
  )

  // Name matching only rescues kills missing encounter data. WCL also names
  // trash segments after the nearest boss (encounterID 0, kill null), and those
  // have no boss data to show.
  return fights.filter(
    (fight) =>
      isBossFightForNavigation(fight) ||
      (fight.kill === true &&
        knownBossNames.has(normalizeEncounterNameForNavigation(fight.name))),
  )
}

/** Resolve boss health remaining for a wipe, or null for kills/unknown. */
export function resolveWipeBossPercentage(
  fight: ReportFightSummary,
): number | null {
  if (fight.kill) {
    return null
  }

  return fight.bossPercentage ?? fight.fightPercentage
}

/** Return unique boss targets in a fight; empty unless several exist. */
export function resolveFightBossTargets(
  fight: ReportFightSummary,
  actors: ReportActorSummary[],
): FightBossTarget[] {
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]))
  const targets = fight.enemyNPCs
    .map((npc) => actorsById.get(npc.id))
    .filter(
      (actor): actor is ReportActorSummary =>
        actor !== undefined && actor.subType === 'Boss',
    )
    .map((actor) => ({ id: actor.id, name: actor.name }))
  const uniqueTargets = Array.from(
    new Map(targets.map((target) => [target.id, target])).values(),
  )

  return uniqueTargets.length > 1 ? uniqueTargets : []
}

/** Group report fights for boss-first fight navigation rendering. */
export function buildFightNavigationGroups(
  fights: ReportFightSummary[],
): FightNavigationGroups {
  const fightOrder = new Map(fights.map((fight, index) => [fight.id, index]))

  const knownBossNames = new Set(
    fights
      .filter(isBossFightForNavigation)
      .map((fight) => normalizeEncounterNameForNavigation(fight.name)),
  )

  const isBossFightFromKnownEncounterName = (
    fight: ReportFightSummary,
  ): boolean =>
    knownBossNames.has(normalizeEncounterNameForNavigation(fight.name))

  const bossFights = fights.filter(
    (fight) =>
      isBossFightForNavigation(fight) ||
      isBossFightFromKnownEncounterName(fight),
  )
  const trashFights = fights
    .filter(
      (fight) =>
        !isBossFightForNavigation(fight) &&
        !isBossFightFromKnownEncounterName(fight),
    )
    .sort((left, right) => {
      if (left.startTime !== right.startTime) {
        return left.startTime - right.startTime
      }

      return left.id - right.id
    })

  const fightsByEncounter = bossFights.reduce(
    (accumulator, fight) => {
      const encounterId = resolveEncounterId(fight)
      const normalizedName = normalizeEncounterNameForNavigation(fight.name)
      const encounterIdLookupKey =
        encounterId !== null ? `encounter-id:${encounterId}` : null

      const existingEncounterKey =
        (encounterIdLookupKey
          ? accumulator.encounterKeyById.get(encounterIdLookupKey)
          : undefined) ?? accumulator.encounterKeyByName.get(normalizedName)

      if (existingEncounterKey) {
        const encounter = accumulator.groups.get(existingEncounterKey)

        if (encounter) {
          encounter.fights.push(fight)

          if (encounter.encounterID === null && encounterId !== null) {
            encounter.encounterID = encounterId
          }

          if (encounterIdLookupKey) {
            accumulator.encounterKeyById.set(
              encounterIdLookupKey,
              existingEncounterKey,
            )
          }
          accumulator.encounterKeyByName.set(
            normalizedName,
            existingEncounterKey,
          )
        }

        return accumulator
      }

      const encounterKey =
        encounterIdLookupKey ?? `encounter-name:${normalizedName}`

      accumulator.groups.set(encounterKey, {
        encounterKey,
        encounterID: encounterId,
        name: fight.name,
        fights: [fight],
      })

      if (encounterIdLookupKey) {
        accumulator.encounterKeyById.set(encounterIdLookupKey, encounterKey)
      }
      accumulator.encounterKeyByName.set(normalizedName, encounterKey)

      return accumulator
    },
    {
      groups: new Map<
        string,
        {
          encounterID: number | null
          encounterKey: string
          name: string
          fights: BossFightSummary[]
        }
      >(),
      encounterKeyById: new Map<string, string>(),
      encounterKeyByName: new Map<string, string>(),
    },
  ).groups

  const encounterRows = Array.from(fightsByEncounter.values()).map(
    (encounter) => {
      const kills = encounter.fights
        .filter((fight) => fight.kill)
        .sort((left, right) => compareByFightOrder(left, right, fightOrder))
      const wipes = encounter.fights
        .filter((fight) => !fight.kill)
        .sort((left, right) => compareByFightOrder(left, right, fightOrder))

      return {
        encounterID: encounter.encounterID,
        encounterKey: encounter.encounterKey,
        name: encounter.name,
        kills,
        wipes,
      }
    },
  )

  const bossEncounters = encounterRows
    .filter((encounter) => encounter.kills.length > 0)
    .map((encounter) => {
      const [primaryKill, ...extraKills] = encounter.kills

      if (!primaryKill) {
        return null
      }

      return {
        encounterID: encounter.encounterID,
        encounterKey: encounter.encounterKey,
        name: encounter.name,
        primaryKill,
        extraKills,
        wipes: encounter.wipes,
      }
    })
    .filter(
      (encounter): encounter is BossEncounterNavigationRow =>
        encounter !== null,
    )
    .sort((left, right) =>
      compareByFightOrder(left.primaryKill, right.primaryKill, fightOrder),
    )

  return {
    bossEncounters,
    trashFights,
  }
}

export interface FightLinkOptions {
  reportId: string
  fightId: number
  configId?: ThreatConfigId | null
  eventsMode?: string | null
  forceFresh?: boolean
  pinnedPlayerIds?: number[]
  targetId?: number | null
}

/** Build a fight route path that carries pinned players, config, fresh, eventsMode and target. */
export function buildFightLinkPath({
  reportId,
  fightId,
  configId = null,
  eventsMode = null,
  forceFresh = false,
  pinnedPlayerIds = [],
  targetId = null,
}: FightLinkOptions): string {
  const pinnedPlayers = [...new Set(pinnedPlayerIds)].sort(
    (left, right) => left - right,
  )
  const searchParams = new URLSearchParams()
  if (forceFresh) {
    searchParams.set('fresh', '1')
  }
  if (pinnedPlayers.length > 0) {
    const pinnedPlayerParam = pinnedPlayers.join(',')
    searchParams.set('pinnedPlayers', pinnedPlayerParam)
    searchParams.set('players', pinnedPlayerParam)
  }
  if (eventsMode) {
    searchParams.set('eventsMode', eventsMode)
  }
  if (configId) {
    searchParams.set('config', configId)
  }
  if (targetId !== null) {
    searchParams.set('targetId', String(targetId))
  }
  const search = searchParams.toString()

  return `/report/${reportId}/fight/${fightId}${search.length > 0 ? `?${search}` : ''}`
}
