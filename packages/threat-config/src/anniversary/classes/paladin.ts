/**
 * Paladin Threat Configuration - Anniversary Edition
 *
 * Spell IDs and threat values are based on Classic/Anniversary Edition mechanics.
 */

import type { ClassThreatConfig, ThreatContext } from '../../types'
import { flat, modAmountFlat, modAmount } from '../../shared/formulas'

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

export const paladinConfig: ClassThreatConfig = {
  auraModifiers: {
    // Righteous Fury: 1.6x (base 60% bonus) or 1.9x with Improved RF talent
    [Spells.RighteousFury]: () => ({
      source: 'stance',
      name: 'Righteous Fury',
      spellId: Spells.RighteousFury,
      value: 1.6, // Base value, improved by talent
    }),

    // Blessing of Sanctuary provides passive threat boost via damage reduction
    [Spells.BlessingOfSanctuary]: () => ({
      source: 'buff',
      name: 'Blessing of Sanctuary',
      spellId: Spells.BlessingOfSanctuary,
      value: 1.0, // Damage dealt by the buff generates threat
    }),
  },

  abilities: {
    // Judgement of Light: 194 flat threat (cast)
    [Spells.JudgementOfLight]: flat(194),

    // Judgement of Wisdom: 194 flat threat (cast)
    [Spells.JudgementOfWisdom]: flat(194),

    // Judgement of Righteousness: damage counts as holy
    [Spells.JudgementOfRighteousness]: modAmount(1),

    // Holy Shield: damage + 35 threat per block (handled per block event)
    [Spells.HolyShield]: modAmountFlat(1, 35),

    // Consecration: damage done (scales with RF)
    [Spells.Consecration]: modAmount(1),

    // Exorcism: standard damage threat
    [Spells.Exorcism]: modAmount(1),

    // Blessings: 60 threat split among enemies
    [Spells.BlessingOfKings]: flat(60, { split: true }),
    [Spells.BlessingOfSalvation]: flat(60, { split: true }),
    [Spells.BlessingOfMight]: flat(60, { split: true }),
    [Spells.BlessingOfWisdom]: flat(60, { split: true }),
    [Spells.BlessingOfSanctuary]: flat(60, { split: true }),
    [Spells.BlessingOfLight]: flat(60, { split: true }),
    [Spells.GreaterBlessingOfKings]: flat(60, { split: true }),
    [Spells.GreaterBlessingOfSalvation]: flat(60, { split: true }),
  },
}
