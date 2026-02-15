/**
 * Shared hateful/hurtful strike raid formulas.
 */
import type { ThreatChange, ThreatFormula } from '@wcl-threat/shared'
import type { HitType } from '@wcl-threat/wcl-types'

const HITTABLE_HIT_TYPES = new Set<HitType>([
  'hit',
  'crit',
  'block',
  'glancing',
  'crushing',
  'immune',
  'resist',
])

function isThreatfulDamageEvent(
  event: Parameters<ThreatFormula>[0]['event'],
  amount: number,
): boolean {
  if (event.type !== 'damage') {
    return false
  }

  const hitType = event.hitType
  if (typeof hitType === 'number') {
    return hitType > 0 && hitType <= 6
  }

  if (typeof hitType === 'string') {
    return HITTABLE_HIT_TYPES.has(hitType)
  }

  return amount > 0
}

function appendThreatChange(
  changes: ThreatChange[],
  sourceId: number,
  targetId: number,
  targetInstance: number,
  amount: number,
  currentThreat: number,
): void {
  if (sourceId <= 0 || amount === 0) {
    return
  }

  const total = currentThreat + amount
  changes.push({
    sourceId,
    targetId,
    targetInstance,
    operator: 'add',
    amount,
    total,
  })
}

/**
 * Build hateful strike formulas that add fixed threat to the boss current tank
 * and to the direct event target.
 */
export function createHatefulStrikeFormula(
  mainTankThreat: number,
  offTankThreat: number,
): ThreatFormula {
  return (ctx) => {
    if (!isThreatfulDamageEvent(ctx.event, ctx.amount)) {
      return undefined
    }

    const enemy = {
      id: ctx.event.sourceID,
      instanceId: ctx.event.sourceInstance ?? 0,
    }

    const currentTarget =
      ctx.actors.getCurrentTarget(enemy) ?? ctx.actors.getLastTarget(enemy)
    const topThreatActorId =
      ctx.actors.getTopActorsByThreat(enemy, 1)[0]?.actorId ?? null
    const mainTankId = currentTarget?.targetId ?? topThreatActorId

    const changes: ThreatChange[] = []
    if (mainTankId !== null) {
      const currentThreat = ctx.actors.getThreat(mainTankId, enemy)
      appendThreatChange(
        changes,
        mainTankId,
        enemy.id,
        enemy.instanceId,
        mainTankThreat,
        currentThreat,
      )
    }

    const offTankId = ctx.event.targetID
    if (offTankId > 0) {
      const currentThreat = ctx.actors.getThreat(offTankId, enemy)
      appendThreatChange(
        changes,
        offTankId,
        enemy.id,
        enemy.instanceId,
        offTankThreat,
        currentThreat,
      )
    }

    if (changes.length === 0) {
      return undefined
    }

    return {
      formula: `hatefulStrike(main=${mainTankThreat}, off=${offTankThreat})`,
      value: 0,
      splitAmongEnemies: false,
      effects: [{ type: 'customThreat', changes }],
    }
  }
}
