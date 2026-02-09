/**
 * Anniversary Edition General Threat Rules
 *
 * Base threat calculations and general mechanics for Anniversary Edition.
 */
import { calculateThreat } from '../shared/formulas'
import type {
  BaseThreatConfig,
  ThreatContext,
  ThreatFormulaResult,
} from '../types'

/**
 * Base threat configurations for Anniversary Edition
 */
export const baseThreat: BaseThreatConfig = {
  /**
   * Damage threat: 1 damage = 1 threat (before modifiers)
   */
  damage: calculateThreat({ modifier: 1 }),

  /**
   * Healing threat: effective healing * 0.5, split among enemies
   * Overheal does not generate threat (handled in getEventAmount)
   */
  heal: (ctx: ThreatContext): ThreatFormulaResult => ({
    formula: 'effectiveHeal * 0.5',
    value: ctx.amount * 0.5,
    splitAmongEnemies: true,
  }),

  /**
   * Resource generation threat: split among enemies
   * - Rage: 5x threat multiplier
   * - Mana: 0.5x threat multiplier
   * - Energy: No threat
   */
  energize: (ctx: ThreatContext): ThreatFormulaResult => {
    const event = ctx.event
    if (event.type !== 'energize') {
      return { formula: '0', value: 0, splitAmongEnemies: false }
    }

    // Energy gains do not generate threat
    if (event.resourceChangeType === 'energy') {
      return {
        formula: '0',
        value: 0,
        splitAmongEnemies: false,
        applyPlayerMultipliers: false,
      }
    }

    // Rage: 5x threat, Mana: 0.5x threat
    const multiplier = event.resourceChangeType === 'rage' ? 5 : 0.5
    const resourceLabel = event.resourceChangeType

    return {
      formula: `${resourceLabel} * ${multiplier}`,
      value: ctx.amount * multiplier,
      splitAmongEnemies: true,
      applyPlayerMultipliers: false,
    }
  },
}
