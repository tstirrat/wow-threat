/**
 * Fight navigation grouping helpers for report-level navigation lists.
 */
import type { ReportFightSummary } from '../types/api'

type BossFightSummary = ReportFightSummary

export interface BossEncounterNavigationRow {
  encounterID: number | null
  encounterKey: string
  name: string
  primaryKill: BossFightSummary
  extraKills: BossFightSummary[]
  wipes: BossFightSummary[]
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
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

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

  const isBossFightFromKnownEncounterName = (fight: ReportFightSummary): boolean =>
    knownBossNames.has(normalizeEncounterNameForNavigation(fight.name))

  const bossFights = fights.filter(
    (fight) => isBossFightForNavigation(fight) || isBossFightFromKnownEncounterName(fight),
  )
  const trashFights = fights
    .filter(
      (fight) => !isBossFightForNavigation(fight) && !isBossFightFromKnownEncounterName(fight),
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
            accumulator.encounterKeyById.set(encounterIdLookupKey, existingEncounterKey)
          }
          accumulator.encounterKeyByName.set(normalizedName, existingEncounterKey)
        }

        return accumulator
      }

      const encounterKey = encounterIdLookupKey ?? `encounter-name:${normalizedName}`

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

  const encounterRows = Array.from(fightsByEncounter.values()).map((encounter) => {
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
  })

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
    .filter((encounter): encounter is BossEncounterNavigationRow => encounter !== null)
    .sort((left, right) =>
      compareByFightOrder(left.primaryKill, right.primaryKill, fightOrder),
    )

  return {
    bossEncounters,
    trashFights,
  }
}
