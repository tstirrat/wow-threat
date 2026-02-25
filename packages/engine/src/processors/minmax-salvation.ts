/**
 * Processor that infers threat-reduction initial auras for non-tanks.
 */
import type {
  Report,
  ReportActor,
  ReportEncounterRankings,
  ReportEncounterRankingsEntry,
  ReportFight,
  ReportRankingsCharacter,
} from '@wow-threat/wcl-types'

import {
  type FightProcessorFactory,
  addInitialAuraAddition,
  initialAuraAdditionsKey,
} from '../event-processors'

const BLESSING_OF_SALVATION_ID = 1038
const GREATER_BLESSING_OF_SALVATION_ID = 25895
const LONG_TERM_BLESSING_AURA_ID_LOOKUP: Readonly<Record<number, true>> = {
  [BLESSING_OF_SALVATION_ID]: true,
  [GREATER_BLESSING_OF_SALVATION_ID]: true,

  // Era paladin blessings
  20217: true, // Blessing of Kings
  25291: true, // Blessing of Might (Rank 7)
  25290: true, // Blessing of Wisdom (Rank 6)
  20914: true, // Blessing of Sanctuary (Rank 4)
  19979: true, // Blessing of Light (Rank 3)
  25894: true, // Greater Blessing of Kings
  25896: true, // Greater Blessing of Might
  25918: true, // Greater Blessing of Wisdom
  25899: true, // Greater Blessing of Sanctuary
  25890: true, // Greater Blessing of Light

  // TBC paladin blessing ranks
  25782: true, // Greater Blessing of Might (Rank 2)
  27140: true, // Blessing of Might (Rank 8)
  27141: true, // Greater Blessing of Might (Rank 3)
  27142: true, // Blessing of Wisdom (Rank 7)
  27143: true, // Greater Blessing of Wisdom (Rank 3)
  27144: true, // Blessing of Light (Rank 4)
  27145: true, // Greater Blessing of Light (Rank 2)
  27168: true, // Blessing of Sanctuary (Rank 5)
  27169: true, // Greater Blessing of Sanctuary (Rank 2)
}

function normalizeFightRankingEntries(
  rankings: ReportEncounterRankings | undefined,
): ReportEncounterRankingsEntry[] {
  if (!Array.isArray(rankings?.data)) {
    return []
  }

  return rankings.data
}

function buildFriendlyPlayerNameLookup(
  reportActors: ReportActor[],
  friendlyPlayerIds: Set<number>,
): Map<string, Set<number>> {
  return reportActors.reduce((result, actor) => {
    if (actor.type !== 'Player' || !friendlyPlayerIds.has(actor.id)) {
      return result
    }

    const normalizedName = actor.name.toLowerCase().trim()
    if (normalizedName.length === 0) {
      return result
    }

    const actorIds = result.get(normalizedName) ?? new Set<number>()
    actorIds.add(actor.id)
    result.set(normalizedName, actorIds)
    return result
  }, new Map<string, Set<number>>())
}

function resolveFightTankActorIdsFromRankings(
  report: Report,
  fight: ReportFight,
): Set<number> {
  const friendlyPlayerIds = new Set(fight.friendlyPlayers ?? [])
  if (friendlyPlayerIds.size === 0) {
    return new Set()
  }

  const friendlyPlayerNameLookup = buildFriendlyPlayerNameLookup(
    report.masterData.actors,
    friendlyPlayerIds,
  )
  const rankingEntries = normalizeFightRankingEntries(
    report.rankings as ReportEncounterRankings,
  )

  return rankingEntries.reduce((tankActorIds, entry) => {
    const rankingFightId = entry.fightID ?? null
    const rankingEncounterId = entry.encounter?.id ?? null
    if (rankingFightId !== null && rankingFightId !== fight.id) {
      return tankActorIds
    }
    if (
      fight.encounterID !== null &&
      fight.encounterID !== undefined &&
      rankingEncounterId !== null &&
      rankingEncounterId !== fight.encounterID
    ) {
      return tankActorIds
    }

    const tankCharacters = entry.roles?.tanks?.characters ?? []
    tankCharacters.forEach((character: ReportRankingsCharacter | null) => {
      const characterId = character?.id ?? null
      if (characterId !== null && friendlyPlayerIds.has(characterId)) {
        tankActorIds.add(characterId)
      }

      const normalizedName = character?.name?.toLowerCase().trim()
      if (!normalizedName) {
        return
      }

      friendlyPlayerNameLookup
        .get(normalizedName)
        ?.forEach((actorId) => tankActorIds.add(actorId))
    })

    return tankActorIds
  }, new Set<number>())
}

function resolveFightThreatReductionBaselineAuraId(
  paladinCount: number,
): number | null {
  return paladinCount > 0 ? GREATER_BLESSING_OF_SALVATION_ID : null
}

function resolveFightPaladinCount(report: Report, fight: ReportFight): number {
  const fightFriendlyPlayerIds = new Set(fight.friendlyPlayers ?? [])

  return report.masterData.actors.filter(
    (actor) =>
      actor.type === 'Player' &&
      fightFriendlyPlayerIds.has(actor.id) &&
      actor.subType === 'Paladin',
  ).length
}
function countActiveBlessingsForActor(actorAuraIds: Set<number>): number {
  return [...actorAuraIds].filter(
    (auraId) => LONG_TERM_BLESSING_AURA_ID_LOOKUP[auraId] === true,
  ).length
}

/**
 * Infer threat-reduction aura seeds for non-tanks missing Salvation.
 */
export const createMinmaxSalvationProcessor: FightProcessorFactory = ({
  report,
  fight,
  inferThreatReduction,
}) => {
  if (!inferThreatReduction || !report || !fight) {
    return null
  }

  const paladinCount = resolveFightPaladinCount(report, fight)
  const baselineAuraId = resolveFightThreatReductionBaselineAuraId(paladinCount)
  if (baselineAuraId === null) {
    return null
  }

  const friendlyPlayerIds = new Set(fight.friendlyPlayers ?? [])
  if (friendlyPlayerIds.size === 0) {
    return null
  }

  const tankActorIds = resolveFightTankActorIdsFromRankings(report, fight)

  return {
    id: 'engine/minmax-salvation',
    finalizePrepass(ctx) {
      const initialAuraAdditionsByActor = ctx.namespace.get(
        initialAuraAdditionsKey,
      )

      friendlyPlayerIds.forEach((actorId) => {
        if (tankActorIds.has(actorId)) {
          return
        }

        const actorAuraIds = new Set([
          ...(ctx.initialAurasByActor.get(actorId) ?? []),
          ...(initialAuraAdditionsByActor?.get(actorId) ?? []),
        ])
        const hasAnySalvation =
          actorAuraIds.has(BLESSING_OF_SALVATION_ID) ||
          actorAuraIds.has(GREATER_BLESSING_OF_SALVATION_ID)
        if (hasAnySalvation) {
          return
        }
        const activeBlessingCount = countActiveBlessingsForActor(actorAuraIds)
        if (activeBlessingCount >= paladinCount) {
          return
        }

        addInitialAuraAddition(ctx.namespace, actorId, baselineAuraId)
      })
    },
  }
}
