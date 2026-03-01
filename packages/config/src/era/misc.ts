/**
 * Global/Non-raid Ability Overrides - Season of Discovery
 */
import type { ThreatFormula } from '@wow-threat/shared'

import {
  modifyThreat,
  noThreat as noThreatFormula,
  threatOnDebuff,
  threatOnDebuffOrDamage,
} from '../shared/formulas'

const noThreat = noThreatFormula()
const diamondFlaskThreat: ThreatFormula = (ctx) => {
  if (ctx.event.type === 'applybuff') {
    return {
      value: 60,
      splitAmongEnemies: true,
      spellModifier: {
        type: 'spell',
        value: 0,
        bonus: 60,
      },
    }
  }

  if (ctx.event.type === 'heal') {
    return {
      value: ctx.amount * 0.5,
      splitAmongEnemies: true,
      spellModifier: {
        type: 'spell',
        value: 0.5,
        bonus: 0,
      },
    }
  }

  return undefined
}

export const miscAbilities: Record<number, ThreatFormula> = {
  // Consumables / item effects
  17624: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['cast'] }), // Flask of Petrification
  11374: threatOnDebuff(90), // Gift of Arthas
  21992: threatOnDebuffOrDamage(90), // Thunderfury
  27648: threatOnDebuff(145), // Thunderfury nature proc
  24427: diamondFlaskThreat, // Diamond Flask activation and periodic heal

  // Zero-threat spells
  20007: noThreat, // Crusader proc
  11350: noThreat, // Oil of Immolation (buff)
  10610: noThreat, // Windfury Totem
  20572: noThreat, // Blood Fury
  26296: noThreat, // Berserking
  26635: noThreat, // Berserking
  22850: noThreat, // Sanctuary
  9515: noThreat, // Summon Tracking Hound
  10667: noThreat, // Rage of Ages
  25804: noThreat, // Rumsey Rum Black Label
  17038: noThreat, // Winterfall Firewater
  8220: noThreat, // Savory Deviate Delight
  17543: noThreat, // Fire Protection
  17548: noThreat, // Greater Shadow Protection Potion
  18125: noThreat, // Blessed Sunfruit
  17538: noThreat, // Elixir of the Mongoose
  11359: noThreat, // Restorative Potion (buff)
  23396: noThreat, // Restorative Potion (dispel)
  6613: noThreat, // Great Rage Potion
  17528: noThreat, // Mighty Rage Potion
  13494: noThreat, // Manual Crowd Pummeler
}
