/**
 * Paladin Threat Configuration - Anniversary Edition
 *
 * Spell IDs and threat values are based on Classic/Anniversary Edition mechanics.
 */
import type {
  ClassThreatConfig,
  SpellId,
  TalentImplicationContext,
} from '@wow-threat/shared'
import { SpellSchool } from '@wow-threat/shared'

import { threat, threatOnBuff } from '../../shared/formulas'
import { inferTalent } from '../../shared/talents'

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
  BlessingOfSanctuary: 20914,
  BlessingOfLight: 27144,
  GreaterBlessingOfKings: 25894,
  GreaterBlessingOfMight: 25896, // 25782 ??
  GreaterBlessingOfWisdom: 25918,
  GreaterBlessingOfSanctuary: 25899,
  GreaterBlessingOfLight: 25890,
  GreaterBlessingOfSalvation: 25895,

  // Defensive
  Sanct4pc: 23302, // Placeholder for set bonus

  // Talents (synthetic aura IDs inferred from combatantinfo)
  ImprovedRighteousFuryR1: 20468,
  ImprovedRighteousFuryR2: 20469,
  ImprovedRighteousFuryR3: 20470,
  VengeanceR1: 20210,
  VengeanceR2: 20212,
  VengeanceR3: 20213,
  VengeanceR4: 20214,
  VengeanceR5: 20215,
} as const

const Mods = {
  RighteousFury: 1.6,
  ImprovedRighteousFuryR1: 1.696,
  ImprovedRighteousFuryR2: 1.798,
  ImprovedRighteousFuryR3: 1.9,
  VengeanceR1: -0.06,
  VengeanceR2: -0.12,
  VengeanceR3: -0.18,
  VengeanceR4: -0.24,
  VengeanceR5: -0.3,
} as const

const IMP_RF_RANKS = [
  Spells.ImprovedRighteousFuryR1,
  Spells.ImprovedRighteousFuryR2,
  Spells.ImprovedRighteousFuryR3,
] as const
const DEFAULT_RIGHTEOUS_FURY_AURA_IDS = [Spells.RighteousFury] as const

const VENGEANCE_RANKS = [
  Spells.VengeanceR1,
  Spells.VengeanceR2,
  Spells.VengeanceR3,
  Spells.VengeanceR4,
  Spells.VengeanceR5,
] as const

export function hasRighteousFuryAura(
  activeAuras: ReadonlySet<SpellId>,
  righteousFuryAuraIds: readonly SpellId[] = DEFAULT_RIGHTEOUS_FURY_AURA_IDS,
): boolean {
  return righteousFuryAuraIds.some((auraId) => activeAuras.has(auraId))
}

const PROT = 1
const IMP_RF_PROT_THRESHOLD = 13
const RET = 2
const VENGEANCE_RET_THRESHOLD = 30

// ============================================================================
// Configuration
// ============================================================================

/** Exclusive aura sets - only one blessing can be active at a time */
export const exclusiveAuras: Set<SpellId>[] = [
  // Blessing are exclusive between lesser and greater. i.e. Salvation replaces Greater Salvation
  new Set([Spells.BlessingOfKings, Spells.GreaterBlessingOfKings]),
  new Set([Spells.BlessingOfSalvation, Spells.GreaterBlessingOfSalvation]),
  new Set([Spells.BlessingOfMight, Spells.GreaterBlessingOfMight]),
  new Set([Spells.BlessingOfWisdom, Spells.GreaterBlessingOfWisdom]),
  new Set([Spells.BlessingOfSanctuary, Spells.GreaterBlessingOfSanctuary]),
  new Set([Spells.BlessingOfLight, Spells.GreaterBlessingOfLight]),
]

export const paladinConfig: ClassThreatConfig = {
  exclusiveAuras,
  auraModifiers: {
    // Righteous Fury: 1.6x (base 60% bonus)
    [Spells.RighteousFury]: () => ({
      source: 'buff',
      name: 'Righteous Fury',

      value: Mods.RighteousFury,
      schoolMask: SpellSchool.Holy,
    }),

    // Improved Righteous Fury increases RF's holy multiplier.
    [Spells.ImprovedRighteousFuryR1]: (ctx) => ({
      source: 'talent',
      name: 'Improved Righteous Fury (Rank 1)',
      value: hasRighteousFuryAura(ctx.sourceAuras)
        ? Mods.ImprovedRighteousFuryR1 / Mods.RighteousFury
        : 1,
      schoolMask: SpellSchool.Holy,
    }),

    [Spells.ImprovedRighteousFuryR2]: (ctx) => ({
      source: 'talent',
      name: 'Improved Righteous Fury (Rank 2)',
      value: hasRighteousFuryAura(ctx.sourceAuras)
        ? Mods.ImprovedRighteousFuryR2 / Mods.RighteousFury
        : 1,
      schoolMask: SpellSchool.Holy,
    }),

    [Spells.ImprovedRighteousFuryR3]: (ctx) => ({
      source: 'talent',
      name: 'Improved Righteous Fury (Rank 3)',
      value: hasRighteousFuryAura(ctx.sourceAuras)
        ? Mods.ImprovedRighteousFuryR3 / Mods.RighteousFury
        : 1,
      schoolMask: SpellSchool.Holy,
    }),

    [Spells.VengeanceR1]: () => ({
      source: 'talent',
      name: 'Vengeance (Rank 1)',
      value: 1 + Mods.VengeanceR1,
    }),
    [Spells.VengeanceR2]: () => ({
      source: 'talent',
      name: 'Vengeance (Rank 2)',
      value: 1 + Mods.VengeanceR2,
    }),
    [Spells.VengeanceR3]: () => ({
      source: 'talent',
      name: 'Vengeance (Rank 3)',
      value: 1 + Mods.VengeanceR3,
    }),
    [Spells.VengeanceR4]: () => ({
      source: 'talent',
      name: 'Vengeance (Rank 4)',
      value: 1 + Mods.VengeanceR4,
    }),
    [Spells.VengeanceR5]: () => ({
      source: 'talent',
      name: 'Vengeance (Rank 5)',
      value: 1 + Mods.VengeanceR5,
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
  },

  abilities: {
    // Judgement of Light: 194 flat threat (cast)
    [Spells.JudgementOfLight]: threat({ modifier: 0, bonus: 194 }),

    // Judgement of Wisdom: 194 flat threat (cast)
    [Spells.JudgementOfWisdom]: threat({ modifier: 0, bonus: 194 }),

    // Judgement of Righteousness: damage counts as holy
    [Spells.JudgementOfRighteousness]: threat({ modifier: 1 }),

    // Holy Shield: damage + 35 threat per block (handled per block event)
    [Spells.HolyShield]: threat({ modifier: 1, bonus: 35 }),

    // Consecration: damage done (scales with RF)
    [Spells.Consecration]: threat({ modifier: 1 }),

    // Exorcism: standard damage threat
    [Spells.Exorcism]: threat({ modifier: 1 }),

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

  talentImplications: (ctx: TalentImplicationContext) => {
    const syntheticAuras: SpellId[] = []

    const impRighteousFurySpellId = inferTalent(ctx, IMP_RF_RANKS, (points) =>
      points[PROT] >= IMP_RF_PROT_THRESHOLD ? 3 : 0,
    )
    if (impRighteousFurySpellId) {
      syntheticAuras.push(impRighteousFurySpellId)
    }

    const vengeanceSpellId = inferTalent(ctx, VENGEANCE_RANKS, (points) =>
      points[RET] >= VENGEANCE_RET_THRESHOLD ? VENGEANCE_RANKS.length : 0,
    )
    if (vengeanceSpellId) {
      syntheticAuras.push(vengeanceSpellId)
    }

    return syntheticAuras
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
