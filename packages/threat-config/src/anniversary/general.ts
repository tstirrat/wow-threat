/**
 * Anniversary Edition General Threat Rules
 *
 * Base threat calculations and general mechanics for Anniversary Edition.
 */

import type { ThreatContext, ThreatFormulaResult, BaseThreatConfig } from '../types'

/**
 * Base threat configurations for Anniversary Edition
 */
export const baseThreat: BaseThreatConfig = {
  /**
   * Damage threat: 1 damage = 1 threat (before modifiers)
   */
  damage: (ctx: ThreatContext): ThreatFormulaResult => ({
    formula: 'amt',
    baseThreat: ctx.amount,
    modifiers: [],
    splitAmongEnemies: false,
  }),

  /**
   * Healing threat: effective healing * 0.5, split among enemies
   * Overheal does not generate threat
   */
  heal: (ctx: ThreatContext): ThreatFormulaResult => {
    // Extract overheal from the event if available
    const event = ctx.event
    const overheal =
      event.type === 'heal' && 'overheal' in event ? event.overheal : 0
    const effectiveHeal = Math.max(0, ctx.amount - overheal)

    return {
      formula: 'effectiveHeal * 0.5',
      baseThreat: effectiveHeal * 0.5,
      modifiers: [],
      splitAmongEnemies: true,
    }
  },

  /**
   * Resource generation threat: resource * 0.5, split among enemies
   * Only mana and energy count (rage does not generate threat from generation)
   */
  energize: (ctx: ThreatContext): ThreatFormulaResult => ({
    formula: 'resource * 0.5',
    baseThreat: ctx.amount * 0.5,
    modifiers: [],
    splitAmongEnemies: true,
  }),
}
