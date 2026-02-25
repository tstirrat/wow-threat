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
import { salvationInferenceMetadataKey } from './keys'

const BLESSING_OF_SALVATION_ID = 1038
const GREATER_BLESSING_OF_SALVATION_ID = 25895

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
  report: Report,
  fight: ReportFight,
): number | null {
  const fightFriendlyPlayerIds = new Set(fight.friendlyPlayers ?? [])
  const hasPaladin = report.masterData.actors.some(
    (actor) =>
      actor.type === 'Player' &&
      fightFriendlyPlayerIds.has(actor.id) &&
      actor.subType === 'Paladin',
  )

  return hasPaladin ? GREATER_BLESSING_OF_SALVATION_ID : null
}

/**
 * Infer threat-reduction aura seeds with Salvation edge-case precedence.
 */
export const createMinmaxSalvationProcessor: FightProcessorFactory = ({
  report,
  fight,
  inferThreatReduction,
}) => {
  if (!inferThreatReduction || !report || !fight) {
    return null
  }

  const baselineAuraId = resolveFightThreatReductionBaselineAuraId(
    report,
    fight,
  )
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
      const salvationInference = ctx.namespace.get(
        salvationInferenceMetadataKey,
      )
      const combatantInfoMinorSalvationPlayerIds =
        salvationInference?.combatantInfoMinorSalvationPlayerIds ??
        new Set<number>()
      const minorSalvationRemovedPlayerIds =
        salvationInference?.minorSalvationRemovedPlayerIds ?? new Set<number>()

      friendlyPlayerIds.forEach((actorId) => {
        if (tankActorIds.has(actorId)) {
          return
        }

        const actorAuraIds = new Set([
          ...(ctx.initialAurasByActor.get(actorId) ?? []),
          ...(initialAuraAdditionsByActor?.get(actorId) ?? []),
        ])
        const hasInitialMinorSalvation =
          actorAuraIds.has(BLESSING_OF_SALVATION_ID) ||
          combatantInfoMinorSalvationPlayerIds.has(actorId)
        const hasMinorSalvationRemoval =
          minorSalvationRemovedPlayerIds.has(actorId)

        const inferredAuraId =
          hasMinorSalvationRemoval && !hasInitialMinorSalvation
            ? BLESSING_OF_SALVATION_ID
            : baselineAuraId === GREATER_BLESSING_OF_SALVATION_ID &&
                hasInitialMinorSalvation
              ? null
              : baselineAuraId

        if (inferredAuraId === null || actorAuraIds.has(inferredAuraId)) {
          return
        }

        addInitialAuraAddition(ctx.namespace, actorId, inferredAuraId)
      })
    },
  }
}
