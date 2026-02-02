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

/**
 * Default formula: threat = event amount
 * Used when no config exists for a spell
 */
export function defaultFormula(options?: FormulaOptions): FormulaFn {
  return (ctx) => ({
    formula: 'amt',
    baseThreat: ctx.amount,
    modifiers: [],
    splitAmongEnemies: options?.split ?? false,
  })
}

/**
 * Flat threat value, ignores event amount
 * Example: Sunder Armor (301 flat threat)
 */
export function flat(value: number, options?: FormulaOptions): FormulaFn {
  return () => ({
    formula: `${value}`,
    baseThreat: value,
    modifiers: [],
    splitAmongEnemies: options?.split ?? false,
  })
}

/**
 * Multiply event amount by modifier
 * Example: heal threat (amt * 0.5)
 */
export function modAmount(mod: number, options?: FormulaOptions): FormulaFn {
  return (ctx) => ({
    formula: mod === 1 ? 'amt' : `amt * ${mod}`,
    baseThreat: ctx.amount * mod,
    modifiers: [],
    splitAmongEnemies: options?.split ?? false,
  })
}

/**
 * Multiply event amount by modifier, then add flat value
 * Example: Shield Slam ((amt * 2) + 150)
 */
export function modAmountFlat(
  mod: number,
  flatVal: number,
  options?: FormulaOptions
): FormulaFn {
  return (ctx) => {
    const base = ctx.amount * mod + flatVal
    let formula: string
    if (mod === 1) {
      formula = `amt + ${flatVal}`
    } else if (mod === 0) {
      formula = `${flatVal}`
    } else {
      formula = `(amt * ${mod}) + ${flatVal}`
    }
    return {
      formula,
      baseThreat: base,
      modifiers: [],
      splitAmongEnemies: options?.split ?? false,
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
      baseThreat: bonus, // Engine adds this to current top threat
      modifiers: [],
      splitAmongEnemies: false,
      special: {
        type: 'taunt',
        fixateDuration,
      },
    }
  }
}

/**
 * Threat drop: removes all threat on target (if not resisted)
 * Example: Vanish, Feign Death
 */
export function threatDrop(): FormulaFn {
  return () => ({
    formula: 'threatDrop',
    baseThreat: 0,
    modifiers: [],
    splitAmongEnemies: false,
    special: {
      type: 'threatDrop',
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
    baseThreat: 0,
    modifiers: [],
    splitAmongEnemies: false,
    special: durationMs
      ? {
          type: 'noThreatWindow',
          duration: durationMs,
        }
      : undefined,
  })
}
