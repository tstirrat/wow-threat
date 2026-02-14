/**
 * Naxxramas Boss Abilities
 *
 * Custom threat formulas for Naxxramas bosses in Anniversary Edition.
 */
import type { ThreatChange, ThreatFormula } from '@wcl-threat/shared'

import { modifyThreat } from '../../shared/formulas'

const HATEFUL_STRIKE_ID = 28308
const NOTH_BLINK_ID = 29210
const NOTH_BLINK_ALT_ID = 29211
const MELEE_RANGE = 10 // yards
const HATEFUL_STRIKE_THREAT = 500

/**
 * Patchwerk - Hateful Strike
 *
 * Adds fixed threat to melee-range targets.
 * This is a boss ability cast on a player, so base threat (value) is 0.
 */
export const hatefulStrike =
  (
    hatefulAmount: number,
    { playerCount }: { playerCount?: number },
  ): ThreatFormula =>
  (ctx) => {
    const targetEnemyId = ctx.event.sourceID // Patchwerk is the source
    const targetEnemyInstance = ctx.event.sourceInstance ?? 0

    // Get top actors by threat against Patchwerk
    const topActors = ctx.actors.getTopActorsByThreat(
      {
        id: targetEnemyId,
        instanceId: targetEnemyInstance,
      },
      100,
    )
    const targetActorId = ctx.event.targetID
    const topActorIds = new Set(topActors.map(({ actorId }) => actorId))
    const targetThreat = ctx.actors.getThreat(targetActorId, {
      id: targetEnemyId,
      instanceId: targetEnemyInstance,
    })
    const topActorsWithTarget =
      topActorIds.has(targetActorId) || targetActorId <= 0
        ? topActors
        : [...topActors, { actorId: targetActorId, threat: targetThreat }]

    const topActorsWithDistance = topActorsWithTarget.map(
      ({ actorId, threat }) => ({
        actorId,
        threat,
        distance: ctx.actors.getDistance(
          { id: actorId },
          { id: targetEnemyId, instanceId: targetEnemyInstance },
        ),
      }),
    )

    // Some logs do not provide position payloads. If no distance data exists,
    // fall back to the top-threat ordering so Hateful Strike still applies.
    const hasDistanceData = topActorsWithDistance.some(
      ({ distance }) => distance !== null,
    )

    const meleeActors = hasDistanceData
      ? topActorsWithDistance.filter(
          ({ distance }) => distance !== null && distance <= MELEE_RANGE,
        )
      : topActorsWithDistance

    // Take top N in melee range
    const targets = meleeActors.slice(0, playerCount)

    // Build explicit ThreatChanges for all N targets
    const changes: ThreatChange[] = targets.map(({ actorId, threat }) => {
      const total = threat + hatefulAmount

      return {
        sourceId: actorId,
        targetId: targetEnemyId,
        targetInstance: targetEnemyInstance,
        operator: 'add',
        amount: hatefulAmount,
        total,
      }
    })

    return {
      formula: `hatefulStrike(${hatefulAmount})`,
      value: hatefulAmount,
      splitAmongEnemies: false,
      effects: [{ type: 'customThreat', changes }],
    }
  }

/**
 * Naxxramas boss abilities
 */
export const naxxAbilities = {
  [HATEFUL_STRIKE_ID]: hatefulStrike(HATEFUL_STRIKE_THREAT, {}),
  [NOTH_BLINK_ID]: modifyThreat({ modifier: 0, target: 'all' }),
  [NOTH_BLINK_ALT_ID]: modifyThreat({ modifier: 0, target: 'all' }),
}
