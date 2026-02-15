/**
 * Karazhan raid mechanics for Anniversary/TBC.
 */
import type {
  EventInterceptor,
  EventInterceptorResult,
  ThreatEffect,
  ThreatFormula,
} from '@wcl-threat/shared'

import { modifyThreat } from '../../shared/formulas'

const NIGHTBANE_LANDING_DELAY_MS = 43_000

function createNightbaneLandingInterceptor(
  enemyId: number,
  enemyInstance: number,
): EventInterceptor {
  return (event, interceptorCtx): EventInterceptorResult => {
    const elapsedMs = interceptorCtx.timestamp - interceptorCtx.installedAt
    if (elapsedMs < NIGHTBANE_LANDING_DELAY_MS) {
      return { action: 'passthrough' }
    }

    const targetInstance = event.targetInstance ?? 0
    if (
      event.sourceIsFriendly !== true ||
      event.targetID !== enemyId ||
      targetInstance !== enemyInstance
    ) {
      return { action: 'passthrough' }
    }

    interceptorCtx.uninstall()

    const currentThreat = interceptorCtx.actors.getTopActorsByThreat(
      { id: enemyId, instanceId: enemyInstance },
      100,
    )
    if (currentThreat.length === 0) {
      return { action: 'passthrough' }
    }

    const wipeEffect: ThreatEffect = {
      type: 'customThreat',
      changes: currentThreat.map(({ actorId }) => ({
        sourceId: actorId,
        targetId: enemyId,
        targetInstance: enemyInstance,
        operator: 'set',
        amount: 0,
        total: 0,
      })),
    }

    return {
      action: 'augment',
      effects: [wipeEffect],
    }
  }
}

const nightbaneRainOfBones: ThreatFormula = (ctx) => {
  if (ctx.event.type !== 'cast') {
    return undefined
  }

  const enemyId = ctx.event.sourceID
  const enemyInstance = ctx.event.sourceInstance ?? 0

  return {
    formula: 'threatWipe + delayedLandingWipe(43s)',
    value: 0,
    splitAmongEnemies: false,
    effects: [
      {
        type: 'modifyThreat',
        multiplier: 0,
        target: 'all',
      },
      {
        type: 'installInterceptor',
        interceptor: createNightbaneLandingInterceptor(enemyId, enemyInstance),
      },
    ],
  }
}

export const karazhanAbilities: Record<number, ThreatFormula> = {
  30013: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['cast'] }), // Disarm
  37098: nightbaneRainOfBones, // Rain of Bones
}
