/**
 * Anniversary Edition General Threat Rules
 *
 * Base threat calculations and general mechanics for Anniversary Edition.
 */
import type { BaseThreatConfig } from '@wcl-threat/shared'
import { ResourceTypeCode } from '@wcl-threat/wcl-types'

import { threat } from '../shared/formulas'

/**
 * Base threat configurations for Anniversary Edition
 */
export const baseThreat: BaseThreatConfig = {
  /**
   * Damage threat: 1 damage = 1 threat (before modifiers)
   */
  damage: threat(),

  /**
   * Healing threat: effective healing * 0.5, split among enemies
   * Overheal does not generate threat (handled in getEventAmount)
   */
  heal: (ctx) => ({
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
  energize: (ctx) => {
    const event = ctx.event
    if (event.type !== 'energize' && event.type !== 'resourcechange') {
      return { formula: '0', value: 0, splitAmongEnemies: false }
    }
    const resourceType = event.resourceChangeType
    const resourceLabelByCode: Record<number, string> = {
      [ResourceTypeCode.Mana]: 'mana',
      [ResourceTypeCode.Rage]: 'rage',
      [ResourceTypeCode.Focus]: 'focus',
      [ResourceTypeCode.Energy]: 'energy',
      [ResourceTypeCode.ComboPoints]: 'combo_points',
      [ResourceTypeCode.RunicPower]: 'runic_power',
      [ResourceTypeCode.HolyPower]: 'holy_power',
    }

    // Energy gains do not generate threat
    if (resourceType === ResourceTypeCode.Energy) {
      return {
        formula: '0',
        value: 0,
        splitAmongEnemies: false,
        applyPlayerMultipliers: false,
      }
    }

    // Rage: 5x threat, Mana: 0.5x threat
    const multiplier = resourceType === ResourceTypeCode.Rage ? 5 : 0.5
    const resourceLabel =
      resourceLabelByCode[resourceType] ?? `resource(${resourceType})`

    return {
      formula: `${resourceLabel} * ${multiplier}`,
      value: ctx.amount * multiplier,
      splitAmongEnemies: true,
      applyPlayerMultipliers: false,
    }
  },
}
