/**
 * Shared hateful/hurtful strike raid formulas.
 */
import type {
  ThreatChange,
  ThreatChangeRequest,
  ThreatFormula,
} from '@wow-threat/shared'
import { type HitType, HitTypeCode } from '@wow-threat/wcl-types'

const HITTABLE_HIT_TYPES = new Set<HitType>([
  HitTypeCode.Hit,
  HitTypeCode.Crit,
  HitTypeCode.Block,
  HitTypeCode.Glancing,
  HitTypeCode.Crushing,
  HitTypeCode.Immune,
  HitTypeCode.Resist,
])

function isThreatfulDamageEvent(
  event: Parameters<ThreatFormula>[0]['event'],
  amount: number,
): boolean {
  if (event.type !== 'damage') {
    return false
  }

  const hitType = event.hitType
  if (hitType !== undefined) {
    return HITTABLE_HIT_TYPES.has(hitType)
  }

  return amount > 0
}

function appendThreatChange(
  changes: ThreatChangeRequest[],
  sourceId: number,
  targetId: number,
  targetInstance: number,
  amount: number,
): void {
  if (sourceId <= 0 || amount === 0) {
    return
  }

  changes.push({
    sourceId,
    targetId,
    targetInstance,
    operator: 'add',
    amount,
  })
}

/**
 * Build hateful strike formulas that add fixed threat to the boss current tank
 * and to the direct event target.
 */
export function createHurtfulStrikeFormula(
  mainTankThreat: number,
  targetThreat: number,
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
      appendThreatChange(
        changes,
        mainTankId,
        enemy.id,
        enemy.instanceId,
        mainTankThreat,
      )
    }

    const targetId = ctx.event.targetID
    if (targetId > 0) {
      appendThreatChange(
        changes,
        targetId,
        enemy.id,
        enemy.instanceId,
        targetThreat,
      )
    }

    if (changes.length === 0) {
      return undefined
    }

    return {
      value: 0,
      splitAmongEnemies: false,
      note: `hurtfulStrike(MT=${mainTankThreat}, target=${targetThreat})`,
      effects: [{ type: 'customThreat', changes }],
    }
  }
}
