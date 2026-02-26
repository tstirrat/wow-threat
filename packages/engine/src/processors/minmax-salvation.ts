/**
 * Processor that infers threat-reduction initial auras for non-tanks.
 */
import type { Report, ReportFight } from '@wow-threat/wcl-types'

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

function resolveFightTankActorIds(
  fight: ReportFight,
  tankActorIdsFromContext: Set<number> | undefined,
): Set<number> {
  const friendlyPlayerIds = new Set(fight.friendlyPlayers ?? [])
  if (friendlyPlayerIds.size === 0 || !tankActorIdsFromContext) {
    return new Set()
  }

  return new Set(
    [...tankActorIdsFromContext].filter((actorId) =>
      friendlyPlayerIds.has(actorId),
    ),
  )
}

function resolveFightThreatReductionBaselineAuraId(
  paladinCount: number,
): number | null {
  return paladinCount > 0 ? GREATER_BLESSING_OF_SALVATION_ID : null
}

function resolveFightPaladinCount(report: Report, fight: ReportFight): number {
  const friendlyPlayerIds = new Set(fight.friendlyPlayers ?? [])

  return report.masterData.actors.filter(
    (actor) =>
      actor.type === 'Player' &&
      friendlyPlayerIds.has(actor.id) &&
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
  tankActorIds,
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

  const resolvedTankActorIds = resolveFightTankActorIds(fight, tankActorIds)

  return {
    id: 'engine/minmax-salvation',
    finalizePrepass(ctx) {
      const initialAuraAdditionsByActor = ctx.namespace.get(
        initialAuraAdditionsKey,
      )

      friendlyPlayerIds.forEach((actorId) => {
        if (resolvedTankActorIds.has(actorId)) {
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
