/**
 * Naxxramas Boss Abilities
 *
 * Custom threat formulas for Naxxramas bosses in Anniversary Edition.
 */
import {
  type ThreatChange,
  type ThreatFormula,
  exists,
} from '@wow-threat/shared'

import { modifyThreat } from '../../shared/formulas'

export const Spells = {
  HatefulStrike: 28308, // https://wowhead.com/classic/spell=28308/
  MagneticPullFeugen: 28339, // https://wowhead.com/classic/spell=28339/
  MagneticPullStalagg: 28338, // https://wowhead.com/classic/spell=28338/
  NothBlink1: 29209, // https://wowhead.com/classic/spell=29209/
  NothBlink2: 29210, // https://wowhead.com/classic/spell=29210/
  NothBlink3: 29211, // https://wowhead.com/classic/spell=29211/
}

// Position payloads are raw map units; for this fight, ~200 raw units ~= 1 yard.
const RAW_DISTANCE_UNITS_PER_YARD = 200
const PATCHWERK_MELEE_RANGE_YARDS = 7

/**
 * Feugen/Stalagg - Magnetic Pull
 *
 * Set the source boss threat for the highest-threat actor on the opposite
 * platform to the source boss current max threat.
 */
export const magneticPull: ThreatFormula = (ctx) => {
  if (ctx.event.type !== 'cast') {
    return undefined
  }

  const sourceEnemy = {
    id: ctx.event.sourceID,
    instanceId: ctx.event.sourceInstance ?? 0,
  }
  const sourceThreatEntries = ctx.actors.getTopActorsByThreat(sourceEnemy, 100)
  const sourceTopThreat = sourceThreatEntries[0]
  if (!sourceTopThreat) {
    return undefined
  }
  const sourceMaxThreat = sourceTopThreat.threat
  const sourceTopActorId = sourceTopThreat.actorId

  const otherEnemies = ctx.actors
    .getFightEnemies()
    .map((enemy) => ({
      id: enemy.id,
      instanceId: enemy.instanceId ?? 0,
    }))
    .filter(
      (enemy) =>
        enemy.id !== sourceEnemy.id ||
        enemy.instanceId !== sourceEnemy.instanceId,
    )

  const topThreat = otherEnemies
    .map((enemy) =>
      ctx.actors
        .getTopActorsByThreat(enemy, 100)
        .find(({ actorId }) => actorId > 0 && actorId !== sourceTopActorId),
    )
    .filter(exists)
    .sort((a, b) => b.threat - a.threat)[0]

  if (!topThreat) {
    return undefined
  }

  return {
    value: 0,
    splitAmongEnemies: false,
    note: 'magneticPull(sourceMaxThreat)',
    effects: [
      {
        type: 'customThreat',
        changes: [
          {
            sourceId: topThreat.actorId,
            targetId: sourceEnemy.id,
            targetInstance: sourceEnemy.instanceId,
            operator: 'set',
            amount: sourceMaxThreat,
            total: sourceMaxThreat,
          },
        ],
      },
    ],
  }
}

/**
 * Patchwerk - Hateful Strike
 *
 * Adds fixed threat to the direct target, plus additional melee-range actors.
 * This is a boss ability cast on a player, so base threat (value) is 0.
 */
export const hatefulStrike =
  ({
    amount,
    playerCount,
  }: {
    amount: number
    playerCount: number
  }): ThreatFormula =>
  (ctx) => {
    const targetEnemyId = ctx.event.sourceID // Patchwerk is the source
    const targetEnemyInstance = ctx.event.sourceInstance ?? 0
    const targetEnemy = {
      id: targetEnemyId,
      instanceId: targetEnemyInstance,
    }
    const directTargetId = ctx.event.targetID
    const includeDirectTarget = directTargetId > 0

    // Top actors by threat against Patchwerk, excluding the direct target.
    const topActors = ctx.actors.getTopActorsByThreat(targetEnemy, 100)
    const additionalCandidates = topActors.filter(
      ({ actorId }) => actorId > 0 && actorId !== directTargetId,
    )

    const additionalCandidatesWithDistance = additionalCandidates.map(
      ({ actorId, threat }) => {
        const rawDistance = ctx.actors.getDistance(
          { id: actorId },
          { id: targetEnemyId, instanceId: targetEnemyInstance },
        )

        return {
          actorId,
          threat,
          distanceYards:
            rawDistance === null
              ? null
              : rawDistance / RAW_DISTANCE_UNITS_PER_YARD,
        }
      },
    )

    const additionalCandidatesWithKnownDistance =
      additionalCandidatesWithDistance.filter(
        ({ distanceYards }) =>
          distanceYards !== null && Number.isFinite(distanceYards),
      )

    // Some logs do not provide position payloads. If no distance data exists,
    // fall back to top-threat ordering for additional targets.
    const hasDistanceData = additionalCandidatesWithKnownDistance.length > 0

    const meleeAdditionalCandidates = hasDistanceData
      ? additionalCandidatesWithKnownDistance.filter(
          ({ distanceYards }) =>
            distanceYards !== null &&
            distanceYards <= PATCHWERK_MELEE_RANGE_YARDS,
        )
      : additionalCandidatesWithDistance

    const additionalTargetCount = Math.max(
      0,
      playerCount - (includeDirectTarget ? 1 : 0),
    )
    const additionalTargets = meleeAdditionalCandidates.slice(
      0,
      additionalTargetCount,
    )

    const directTarget = includeDirectTarget
      ? [
          {
            actorId: directTargetId,
            threat: ctx.actors.getThreat(directTargetId, targetEnemy),
          },
        ]
      : []

    const targets = [...directTarget, ...additionalTargets]

    // Build explicit ThreatChanges for all selected targets.
    const changes: ThreatChange[] = targets.map(({ actorId, threat }) => {
      const total = threat + amount

      return {
        sourceId: actorId,
        targetId: targetEnemy.id,
        targetInstance: targetEnemy.instanceId,
        operator: 'add',
        amount,
        total,
      }
    })

    return {
      value: amount,
      splitAmongEnemies: false,
      spellModifier: {
        type: 'spell',
        value: 0,
        bonus: amount,
      },
      note: 'hatefulStrike(target+nearbyMelee)',
      effects: [{ type: 'customThreat', changes }],
    }
  }

/**
 * Naxxramas boss abilities
 */
export const naxxAbilities = {
  [Spells.HatefulStrike]: hatefulStrike({ amount: 500, playerCount: 4 }),
  [Spells.MagneticPullFeugen]: magneticPull,
  [Spells.MagneticPullStalagg]: magneticPull,
  [Spells.NothBlink1]: modifyThreat({ modifier: 0, target: 'all' }),
  [Spells.NothBlink2]: modifyThreat({ modifier: 0, target: 'all' }),
  [Spells.NothBlink3]: modifyThreat({ modifier: 0, target: 'all' }),
}
