/**
 * Built-in Threat Formulas
 *
 * These helper functions create threat formula functions that can be used
 * in class configurations.
 */

import type { ThreatContext, ThreatFormulaResult } from '../types'

export type FormulaFn = (ctx: ThreatContext) => ThreatFormulaResult

export interface FormulaOptions {
  /** Split threat among all enemies */
  split?: boolean
}

export interface CalculateThreatOptions {
  /** Multiplier applied to event amount (default: 1) */
  modifier?: number
  /** Flat bonus threat added after modifier (default: 0) */
  bonus?: number
  /** Split threat among all enemies (default: false) */
  split?: boolean
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
export function calculateThreat(options: CalculateThreatOptions = {}): FormulaFn {
  const { modifier = 1, bonus = 0, split = false } = options

  return (ctx) => {
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
    }
  }
}



export interface TauntOptions {
  /** Add damage amount to threat (e.g., Mocking Blow) */
  addDamage?: boolean
}

/**
 * Taunt: sets threat to top threat + bonus, fixates target
 * Example: Taunt (top + 1, fixate 3s), Mocking Blow (top + damage, fixate 6s)
 */
export function tauntTarget(
  bonusThreat: number,
  fixateDuration: number,
  options?: TauntOptions
): FormulaFn {
  return (ctx) => {
    const bonus = options?.addDamage ? ctx.amount + bonusThreat : bonusThreat
    return {
      formula: options?.addDamage
        ? `topThreat + amt + ${bonusThreat}`
        : `topThreat + ${bonusThreat}`,
      value: bonus, // Engine adds this to current top threat
      splitAmongEnemies: false,
      special: {
        type: 'taunt',
        fixateDuration,
      },
    }
  }
}

/**
 * Threat modification: multiplies target's current threat against source
 * Examples:
 *   modifyThreat(0) - Threat wipe (Vanish, Feign Death)
 *   modifyThreat(0.5) - Halve threat (Onyxia's Knockaway)
 *   modifyThreat(2) - Double threat (theoretical boss mechanic)
 */
export function modifyThreat(multiplier: number): FormulaFn {
  return () => ({
    formula: multiplier === 0 ? 'threatWipe' : `threat * ${multiplier}`,
    value: 0,
    splitAmongEnemies: false,
    special: {
      type: 'modifyThreat',
      multiplier,
    },
  })
}

/**
 * No threat: spell generates zero threat, optionally for a time window
 * Example: Misdirection (no threat for 30s after cast)
 */
export function noThreat(durationMs?: number): FormulaFn {
  return () => ({
    formula: '0',
    value: 0,
    splitAmongEnemies: false,
    special: durationMs
      ? {
          type: 'noThreatWindow',
          duration: durationMs,
        }
      : undefined,
  })
}

/**
 * Flat threat on debuff application (e.g., Demoralizing Shout)
 * Note: For abilities that miss, this should be paired with castCanMiss
 */
export function threatOnDebuff(value: number): FormulaFn {
  return () => ({
    formula: `${value}`,
    value,
    splitAmongEnemies: false,
  })
}

/**
 * Flat threat on buff application (e.g., Battle Shout)
 * Usually split among enemies
 */
export function threatOnBuff(
  value: number,
  options?: FormulaOptions
): FormulaFn {
  return () => ({
    formula: `${value}`,
    value,
    splitAmongEnemies: options?.split ?? true,
  })
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
export function castCanMiss(value: number): FormulaFn {
  return () => ({
    formula: `${value} (cast)`,
    value,
    splitAmongEnemies: false,
  })
}

