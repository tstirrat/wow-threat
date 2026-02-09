/**
 * Built-in Threat Formulas
 *
 * These helper functions create threat formula functions that can be used
 * in class configurations.
 */
import type { EventType, HitType } from '@wcl-threat/wcl-types'

import type { ThreatContext, ThreatFormulaResult } from '../types'

export type FormulaFn = (ctx: ThreatContext) => ThreatFormulaResult | undefined

export interface FormulaOptions {
  /** Split threat among all enemies */
  split?: boolean
  /** Event types that should trigger this formula */
  eventTypes?: EventType[]
  /** Whether to apply player multipliers (class/aura/talent). Defaults to true. */
  applyPlayerMultipliers?: boolean
}

export interface CalculateThreatOptions {
  /** Multiplier applied to event amount (default: 1) */
  modifier?: number
  /** Flat bonus threat added after modifier (default: 0) */
  bonus?: number
  /** Split threat among all enemies (default: false) */
  split?: boolean
  /** Event types that should trigger this formula */
  eventTypes?: EventType[]
  /** Whether to apply player multipliers (class/aura/talent). Defaults to true. */
  applyPlayerMultipliers?: boolean
}

const buffAuraEventTypes: EventType[] = [
  'applybuff',
  'refreshbuff',
  'applybuffstack',
]
const debuffAuraEventTypes: EventType[] = [
  'applydebuff',
  'refreshdebuff',
  'applydebuffstack',
]
const tauntAuraEventTypes: EventType[] = [
  ...buffAuraEventTypes,
  ...debuffAuraEventTypes,
]
const castRollbackHitTypes = new Set<HitType>([
  'miss',
  'dodge',
  'parry',
  'immune',
  'resist',
])

function isEventTypeAllowed(
  eventType: EventType,
  allowedEventTypes?: EventType[],
): boolean {
  if (!allowedEventTypes || allowedEventTypes.length === 0) {
    return true
  }
  return allowedEventTypes.includes(eventType)
}

/**
 * Consolidated threat formula: (amount × modifier) + bonus
 * Replaces flat(), modAmount(), modAmountFlat(), defaultFormula(), threatOnBuff(), modHeal()
 *
 * @example
 * calculateThreat() // amt (default damage)
 * calculateThreat({ modifier: 2 }) // amt * 2
 * calculateThreat({ modifier: 0, bonus: 301 }) // 301 (flat threat)
 * calculateThreat({ modifier: 2, bonus: 150 }) // (amt * 2) + 150
 * calculateThreat({ modifier: 0.5, split: true }) // amt * 0.5 (split among enemies)
 */
export function calculateThreat(
  options: CalculateThreatOptions = {},
): FormulaFn {
  const {
    modifier = 1,
    bonus = 0,
    split = false,
    eventTypes,
    applyPlayerMultipliers,
  } = options

  return (ctx) => {
    if (!isEventTypeAllowed(ctx.event.type, eventTypes)) {
      return undefined
    }

    const value = ctx.amount * modifier + bonus

    // Generate formula string
    let formula: string
    if (modifier === 0 && bonus !== 0) {
      // Pure flat threat: "301"
      formula = `${bonus}`
    } else if (modifier === 1 && bonus === 0) {
      // Default: "amt"
      formula = 'amt'
    } else if (modifier === 1 && bonus !== 0) {
      // Amount + bonus: "amt + 150"
      formula = `amt + ${bonus}`
    } else if (modifier === 0 && bonus === 0) {
      // Zero threat: "0"
      formula = '0'
    } else if (bonus === 0) {
      // Pure multiplier: "amt * 2"
      formula = `amt * ${modifier}`
    } else {
      // Full formula: "(amt * 2) + 150"
      formula = `(amt * ${modifier}) + ${bonus}`
    }

    return {
      formula,
      value,
      splitAmongEnemies: split,
      applyPlayerMultipliers,
    }
  }
}

export interface TauntOptions {
  /** Multiplier applied to event amount (default: 0) */
  modifier?: number
  /** Flat bonus threat added after modifier (default: 0) */
  bonus?: number
  /** Event types that should trigger this formula */
  eventTypes?: EventType[]
}

export interface ModifyThreatOptions {
  /** Threat multiplier to apply */
  modifier: number
  /** Target scope for threat modification */
  target?: 'target' | 'all'
}

export interface ThreatOnCastRollbackOnMissOptions {
  /** Whether to apply player multipliers (class/aura/talent). Defaults to true. */
  applyPlayerMultipliers?: boolean
}

/**
 * Taunt: sets source threat to top threat + ((amount * modifier) + bonus)
 * on the event target enemy.
 * Example: Taunt ({ bonus: 1 }), Mocking Blow ({ modifier: 1 })
 */
export function tauntTarget(options: TauntOptions = {}): FormulaFn {
  const {
    modifier = 0,
    bonus = 0,
    eventTypes = tauntAuraEventTypes,
  } = options

  return (ctx) => {
    if (!isEventTypeAllowed(ctx.event.type, eventTypes)) {
      return undefined
    }

    const bonusThreat = ctx.amount * modifier + bonus
    const sourceId = ctx.sourceActor.id
    const targetId = ctx.targetActor.id
    const targetInstance = ctx.event.targetInstance ?? 0
    const currentThreat = ctx.actors.getThreat(sourceId, {
      id: targetId,
      instanceId: targetInstance,
    })
    const topThreat = ctx.actors.getTopActorsByThreat(
      {
        id: targetId,
        instanceId: targetInstance,
      },
      1,
    )[0]?.threat ?? 0
    const nextThreat = Math.max(currentThreat, topThreat + bonusThreat)

    let formula: string
    if (modifier === 0) {
      formula = `topThreat + ${bonus}`
    } else if (modifier === 1 && bonus === 0) {
      formula = 'topThreat + amt'
    } else if (modifier === 1) {
      formula = `topThreat + amt + ${bonus}`
    } else if (bonus === 0) {
      formula = `topThreat + (amt * ${modifier})`
    } else {
      formula = `topThreat + (amt * ${modifier}) + ${bonus}`
    }

    return {
      formula,
      value: 0,
      splitAmongEnemies: false,
      effects: [
        {
          type: 'customThreat',
          changes: [
            {
              sourceId,
              targetId,
              targetInstance,
              operator: 'set',
              amount: nextThreat,
              total: nextThreat,
            },
          ],
        },
      ],
    }
  }
}

/**
 * Threat modification: multiplies target's current threat against source
 * Examples:
 *   modifyThreat({ modifier: 0 }) - Threat wipe on event target (Vanish, Feign Death)
 *   modifyThreat({ modifier: 0.5 }) - Halve threat on event target (Onyxia's Knockaway)
 *   modifyThreat({ modifier: 0, target: 'all' }) - Wipe all threat on source enemy (Noth Blink)
 */
export function modifyThreat(options: ModifyThreatOptions): FormulaFn {
  const { modifier, target = 'target' } = options

  return () => ({
    formula: modifier === 0 ? 'threatWipe' : `threat * ${modifier}`,
    value: 0,
    splitAmongEnemies: false,
    effects: [
      {
        type: 'modifyThreat',
        multiplier: modifier,
        target,
      },
    ],
  })
}

/**
 * No threat: spell generates zero threat
 */
export function noThreat(): FormulaFn {
  return () => ({
    formula: '0',
    value: 0,
    splitAmongEnemies: false,
  })
}

/**
 * Flat threat on debuff application (e.g., Demoralizing Shout)
 * Note: For abilities that miss, this should be paired with
 * threatOnCastRollbackOnMiss
 */
export function threatOnDebuff(value: number): FormulaFn {
  const eventTypes = debuffAuraEventTypes

  return (ctx) => {
    if (!isEventTypeAllowed(ctx.event.type, eventTypes)) {
      return undefined
    }

    return {
      formula: `${value}`,
      value,
      splitAmongEnemies: false,
    }
  }
}

/**
 * Flat threat on buff application (e.g., Battle Shout)
 * Usually split among enemies
 */
export function threatOnBuff(
  value: number,
  options?: FormulaOptions,
): FormulaFn {
  const eventTypes = options?.eventTypes ?? buffAuraEventTypes

  return (ctx) => {
    if (!isEventTypeAllowed(ctx.event.type, eventTypes)) {
      return undefined
    }

    return {
      formula: `${value}`,
      value,
      splitAmongEnemies: options?.split ?? true,
      applyPlayerMultipliers: options?.applyPlayerMultipliers,
    }
  }
}

/**
 * Heal with modified threat coefficient
 * Example: Paladin heals (amt * 0.25), normal heals (amt * 0.5)
 * Always splits among enemies
 */
export function modHeal(multiplier: number): FormulaFn {
  return (ctx) => ({
    formula: multiplier === 0.5 ? 'amt * 0.5' : `amt * ${multiplier}`,
    value: ctx.amount * multiplier,
    splitAmongEnemies: true,
  })
}

/**
 * Threat on cast that can miss - threat is applied on cast,
 * then removed if the ability misses (damage event with hitType > 6)
 * Example: Sunder Armor
 */
export function threatOnCastRollbackOnMiss(
  value: number,
  options: ThreatOnCastRollbackOnMissOptions = {},
): FormulaFn {
  return (ctx) => {
    if (ctx.event.type === 'cast') {
      return {
        formula: `${value} (cast)`,
        value,
        splitAmongEnemies: false,
        applyPlayerMultipliers: options.applyPlayerMultipliers,
      }
    }

    if (
      ctx.event.type === 'damage' &&
      castRollbackHitTypes.has(ctx.event.hitType)
    ) {
      return {
        formula: `-${value} (miss rollback)`,
        value: -value,
        splitAmongEnemies: false,
        applyPlayerMultipliers: options.applyPlayerMultipliers,
      }
    }

    if (ctx.event.type !== 'damage') {
      return undefined
    }
    return undefined
  }
}
