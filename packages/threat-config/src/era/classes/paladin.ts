/**
 * Paladin Threat Configuration - Anniversary Edition
 *
 * Spell IDs and threat values are based on Classic/Anniversary Edition mechanics.
 */
import { type ClassThreatConfig, SpellSchool } from '@wcl-threat/shared'

import { calculateThreat, threatOnBuff } from '../../shared/formulas'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  // Core abilities
  RighteousFury: 25780,
  SealOfRighteousness: 25742,
  JudgementOfLight: 20271,
  JudgementOfWisdom: 20186,
  JudgementOfRighteousness: 25713,
  Consecration: 27173,
  HolyShield: 27179,
  AvengersShield: 27180, // TBC but included for completeness
  Exorcism: 27138,

  // Blessings (generate threat when cast)
  BlessingOfKings: 25898,
  BlessingOfSalvation: 25846,
  BlessingOfMight: 27140,
  BlessingOfWisdom: 27142,
  BlessingOfSanctuary: 25899,
  BlessingOfLight: 27144,
  GreaterBlessingOfKings: 25894,
  GreaterBlessingOfSalvation: 25895,

  // Defensive
  Sanct4pc: 23302, // Placeholder for set bonus

  // Talents
  ImprovedRighteousFuryR1: 20468,
  ImprovedRighteousFuryR2: 20469,
} as const

const Mods = {
  RighteousFury: 1.6,
  ImprovedRighteousFuryR1: 1.7,
  ImprovedRighteousFuryR2: 1.9,
} as const

// ============================================================================
// Configuration
// ============================================================================

/** Exclusive aura sets - only one blessing can be active at a time */
export const exclusiveAuras: Set<number>[] = [
  // All blessings (normal and greater) are mutually exclusive
  new Set([Spells.BlessingOfKings, Spells.GreaterBlessingOfKings]),
  new Set([Spells.BlessingOfSalvation, Spells.GreaterBlessingOfSalvation]),
]

export const paladinConfig: ClassThreatConfig = {
  exclusiveAuras,
  auraModifiers: {
    // Righteous Fury: 1.6x (base 60% bonus) or 1.9x with Improved RF talent
    [Spells.RighteousFury]: () => ({
      source: 'buff',
      name: 'Righteous Fury',

      value: Mods.RighteousFury,
      schools: new Set([SpellSchool.Holy]),
    }),

    [Spells.ImprovedRighteousFuryR1]: () => ({
      source: 'buff',
      name: 'Improved Righteous Fury (Rank 1)',
      value:
        (Mods.ImprovedRighteousFuryR1 + Mods.RighteousFury) /
        Mods.RighteousFury,
      schools: new Set([SpellSchool.Holy]),
    }),

    [Spells.ImprovedRighteousFuryR2]: () => ({
      source: 'buff',
      name: 'Improved Righteous Fury (Rank 2)',
      value:
        (Mods.ImprovedRighteousFuryR2 + Mods.RighteousFury) /
        Mods.RighteousFury,
      schools: new Set([SpellSchool.Holy]),
    }),

    // Blessing of Salvation - 0.7x threat
    [Spells.BlessingOfSalvation]: () => ({
      source: 'buff',
      name: 'Blessing of Salvation',

      value: 0.7,
    }),

    // Greater Blessing of Salvation - 0.7x threat
    [Spells.GreaterBlessingOfSalvation]: () => ({
      source: 'buff',
      name: 'Greater Blessing of Salvation',

      value: 0.7,
    }),

    // Blessing of Sanctuary provides passive threat boost via damage reduction
    [Spells.BlessingOfSanctuary]: () => ({
      source: 'buff',
      name: 'Blessing of Sanctuary',

      value: 1.0, // Damage dealt by the buff generates threat
    }),
  },

  abilities: {
    // Judgement of Light: 194 flat threat (cast)
    [Spells.JudgementOfLight]: calculateThreat({ modifier: 0, bonus: 194 }),

    // Judgement of Wisdom: 194 flat threat (cast)
    [Spells.JudgementOfWisdom]: calculateThreat({ modifier: 0, bonus: 194 }),

    // Judgement of Righteousness: damage counts as holy
    [Spells.JudgementOfRighteousness]: calculateThreat({ modifier: 1 }),

    // Holy Shield: damage + 35 threat per block (handled per block event)
    [Spells.HolyShield]: calculateThreat({ modifier: 1, bonus: 35 }),

    // Consecration: damage done (scales with RF)
    [Spells.Consecration]: calculateThreat({ modifier: 1 }),

    // Exorcism: standard damage threat
    [Spells.Exorcism]: calculateThreat({ modifier: 1 }),

    // Blessings: 60 threat split among enemies
    [Spells.BlessingOfKings]: threatOnBuff(60, { split: true }),
    [Spells.BlessingOfSalvation]: threatOnBuff(60, { split: true }),
    [Spells.BlessingOfMight]: threatOnBuff(60, { split: true }),
    [Spells.BlessingOfWisdom]: threatOnBuff(60, { split: true }),
    [Spells.BlessingOfSanctuary]: threatOnBuff(60, { split: true }),
    [Spells.BlessingOfLight]: threatOnBuff(60, { split: true }),
    [Spells.GreaterBlessingOfKings]: threatOnBuff(60, { split: true }),
    [Spells.GreaterBlessingOfSalvation]: threatOnBuff(60, { split: true }),
  },

  invulnerabilityBuffs: new Set([
    498,
    5573, // Divine Protection
    642,
    1020, // Divine Shield
    1022,
    5599,
    10278, // Blessing of Protection
    19752, // Divine Intervention
  ]),
}
