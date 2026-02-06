/**
 * Paladin Threat Configuration - Anniversary Edition
 *
 * Spell IDs and threat values are based on Classic/Anniversary Edition mechanics.
 */
import { calculateThreat } from '../../shared/formulas'
import type { ClassThreatConfig } from '../../types'

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
} as const

// ============================================================================
// Configuration
// ============================================================================

/** Exclusive aura sets - only one blessing can be active at a time */
export const exclusiveAuras: Set<number>[] = [
  // All blessings (normal and greater) are mutually exclusive
  new Set([
    Spells.BlessingOfKings,
    Spells.BlessingOfSalvation,
    Spells.BlessingOfMight,
    Spells.BlessingOfWisdom,
    Spells.BlessingOfSanctuary,
    Spells.BlessingOfLight,
    Spells.GreaterBlessingOfKings,
    Spells.GreaterBlessingOfSalvation,
  ]),
]

export const paladinConfig: ClassThreatConfig = {
  exclusiveAuras,
  auraModifiers: {
    // Righteous Fury: 1.6x (base 60% bonus) or 1.9x with Improved RF talent
    [Spells.RighteousFury]: () => ({
      source: 'stance',
      name: 'Righteous Fury',

      value: 1.6, // Base value, improved by talent
      schools: new Set(['holy']),
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
    [Spells.BlessingOfKings]: calculateThreat({
      modifier: 0,
      bonus: 60,
      split: true,
    }),
    [Spells.BlessingOfSalvation]: calculateThreat({
      modifier: 0,
      bonus: 60,
      split: true,
    }),
    [Spells.BlessingOfMight]: calculateThreat({
      modifier: 0,
      bonus: 60,
      split: true,
    }),
    [Spells.BlessingOfWisdom]: calculateThreat({
      modifier: 0,
      bonus: 60,
      split: true,
    }),
    [Spells.BlessingOfSanctuary]: calculateThreat({
      modifier: 0,
      bonus: 60,
      split: true,
    }),
    [Spells.BlessingOfLight]: calculateThreat({
      modifier: 0,
      bonus: 60,
      split: true,
    }),
    [Spells.GreaterBlessingOfKings]: calculateThreat({
      modifier: 0,
      bonus: 60,
      split: true,
    }),
    [Spells.GreaterBlessingOfSalvation]: calculateThreat({
      modifier: 0,
      bonus: 60,
      split: true,
    }),
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
