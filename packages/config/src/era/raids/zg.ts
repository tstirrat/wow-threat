/**
 * Zul'Gurub Encounter Hooks
 *
 * Encounter-level preprocessors and raid-specific spell sets for Vanilla Era.
 */
import type {
  EncounterId,
  EncounterPreprocessorFactory,
  EncounterThreatConfig,
  SpellId,
} from '@wow-threat/shared'

import { type FormulaFn, isHit, noThreat } from '../../shared/formulas'

export const Spells = {
  ForcePunch: 24189, // https://www.wowhead.com/classic/spell=24189/force-punch
  CauseInsanity: 24327, // https://www.wowhead.com/classic/spell=24327/hakkar-s-cause-insanity
} as const

/**
 * Aggro-loss buffs from Zul'Gurub bosses.
 */
export const zgAggroLossBuffs: ReadonlySet<SpellId> = new Set([
  Spells.CauseInsanity,
])

export const ZgEncounterIds = {
  HighPriestessArlokk: 791 as EncounterId,
  // Anniversary/fresh logs can namespace classic encounter IDs by zone.
  HighPriestessArlokkFresh: 150791 as EncounterId,
} as const

export const Boss = {
  HighPriestessArlokk: 14515,
} as const

const ARLOKK_DISAPPEAR_GAP_MS = 30_000

/**
 * Track hostile gaps and apply a threat wipe on Arlokk's first event after reappearance.
 */
const createArlokkPreprocessor: EncounterPreprocessorFactory = (ctx) => {
  const lastEventTimestampBySource = new Map<number, number>()
  const arlokkIds = new Set(
    ctx.enemies
      .filter((enemy) => enemy.gameID === Boss.HighPriestessArlokk)
      .map((enemy) => enemy.id),
  )

  return (preprocessCtx) => {
    const event = preprocessCtx.event

    if (!arlokkIds.has(event.sourceID)) {
      return undefined
    }

    const previousEventTimestamp = lastEventTimestampBySource.get(
      event.sourceID,
    )
    lastEventTimestampBySource.set(event.sourceID, event.timestamp)

    if (
      previousEventTimestamp === undefined ||
      event.timestamp - previousEventTimestamp <= ARLOKK_DISAPPEAR_GAP_MS
    ) {
      return undefined
    }

    return {
      effects: [{ type: 'modifyThreat', multiplier: 0, target: 'all' }],
    }
  }
}

export const zgEncounters: Record<EncounterId, EncounterThreatConfig> = {
  [ZgEncounterIds.HighPriestessArlokk]: {
    preprocessor: createArlokkPreprocessor,
  },
  [ZgEncounterIds.HighPriestessArlokkFresh]: {
    preprocessor: createArlokkPreprocessor,
  },
}

export const zgAbilities: Record<SpellId, FormulaFn> = {
  [Spells.ForcePunch]: noThreat(),
}

// The guides say that this is a threat drop, but looking at boss melee,
// it seems the tank maintains aggro
// TODO: Verify Thekal threat drops.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function forcePush(): FormulaFn {
  return (ctx) => {
    if (ctx.event.type !== 'damage' || !isHit(ctx.event.hitType)) {
      return undefined
    }

    const boss = ctx.actors.getActor?.({
      id: ctx.event.sourceID,
      instanceId: ctx.event.sourceInstance,
    })

    if (!boss) {
      return undefined
    }

    const target = ctx.actors.getCurrentTarget({
      id: ctx.event.sourceID,
      instanceId: ctx.event.sourceInstance,
    })

    if (!target) {
      return undefined
    }

    if (target.targetId === ctx.event.targetID) {
      return {
        formula: 'forcePunch(target)',
        value: 0,
        splitAmongEnemies: false,
        effects: [
          {
            type: 'customThreat',
            changes: [
              {
                operator: 'set',
                sourceId: target.targetId,
                targetId: boss.id,
                targetInstance: boss.instanceId,
                amount: 0,
              },
            ],
          },
        ],
      }
    }
  }
}
