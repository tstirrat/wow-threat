/**
 * Anniversary Edition General Threat Rules
 *
 * Base threat calculations and general mechanics for Anniversary Edition.
 */
import type { BaseThreatConfig } from '@wow-threat/shared'
import { ResourceTypeCode } from '@wow-threat/wcl-types'

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
   * Absorbed threat: absorbed amount generates threat on a single target.
   * Threat is attributed to event.sourceID (absorbed-event caster in WCL payloads).
   */
  absorbed: (ctx) => ({
    formula: 'absorbAmount',
    value: ctx.amount,
    splitAmongEnemies: false,
  }),

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
      return undefined
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
      return undefined
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
