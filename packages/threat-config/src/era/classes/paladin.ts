/**
 * Paladin Threat Configuration - Anniversary Edition
 *
 * Spell IDs and threat values are based on Classic/Anniversary Edition mechanics.
 */
import type {
  ClassThreatConfig,
  TalentImplicationContext,
} from '@wcl-threat/shared'
import { SpellSchool } from '@wcl-threat/shared'

import { calculateThreat, threatOnBuff } from '../../shared/formulas'
import { clampRank, inferMappedTalentRank } from '../../shared/talents'

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

const IMPROVED_RIGHTEOUS_FURY_AURA_BY_RANK = [
  Spells.ImprovedRighteousFuryR1,
  Spells.ImprovedRighteousFuryR2,
  Spells.ImprovedRighteousFuryR3,
] as const

const VENGEANCE_AURA_BY_RANK = [
  Spells.VengeanceR1,
  Spells.VengeanceR2,
  Spells.VengeanceR3,
  Spells.VengeanceR4,
  Spells.VengeanceR5,
] as const

const IMPROVED_RIGHTEOUS_FURY_RANK_BY_TALENT_ID = new Map<number, number>(
  IMPROVED_RIGHTEOUS_FURY_AURA_BY_RANK.map((spellId, idx) => [
    spellId,
    idx + 1,
  ]),
)

const VENGEANCE_RANK_BY_TALENT_ID = new Map<number, number>(
  VENGEANCE_AURA_BY_RANK.map((spellId, idx) => [spellId, idx + 1]),
)

const PROTECTION_TREE_INDEX = 1
const IMPROVED_RIGHTEOUS_FURY_PROTECTION_POINTS_THRESHOLD = 13
const RETRIBUTION_TREE_INDEX = 2
const VENGEANCE_RETRIBUTION_POINTS_THRESHOLD = 30

function inferImprovedRighteousFuryRank(ctx: TalentImplicationContext): number {
  const fromRankSpellIds = inferMappedTalentRank(
    ctx.talentRanks,
    IMPROVED_RIGHTEOUS_FURY_RANK_BY_TALENT_ID,
    IMPROVED_RIGHTEOUS_FURY_AURA_BY_RANK.length,
  )
  const rankedImprovedRighteousFury = clampRank(
    Math.max(
      fromRankSpellIds,
      ctx.talentRanks.get(Spells.ImprovedRighteousFuryR1) ?? 0,
    ),
    IMPROVED_RIGHTEOUS_FURY_AURA_BY_RANK.length,
  )
  if (rankedImprovedRighteousFury > 0) {
    return rankedImprovedRighteousFury
  }

  const protectionPoints = Math.trunc(
    ctx.talentPoints[PROTECTION_TREE_INDEX] ?? 0,
  )
  if (protectionPoints < IMPROVED_RIGHTEOUS_FURY_PROTECTION_POINTS_THRESHOLD) {
    return 0
  }

  // Legacy payloads can omit per-talent ranks and only include tree splits.
  // At 13+ protection points, infer max Improved Righteous Fury rank.
  return IMPROVED_RIGHTEOUS_FURY_AURA_BY_RANK.length
}

function inferVengeanceRank(ctx: TalentImplicationContext): number {
  const vengeanceRank = inferMappedTalentRank(
    ctx.talentRanks,
    VENGEANCE_RANK_BY_TALENT_ID,
    VENGEANCE_AURA_BY_RANK.length,
  )
  if (vengeanceRank > 0) {
    return vengeanceRank
  }

  const retributionPoints = Math.trunc(
    ctx.talentPoints[RETRIBUTION_TREE_INDEX] ?? 0,
  )
  if (retributionPoints < VENGEANCE_RETRIBUTION_POINTS_THRESHOLD) {
    return 0
  }

  // Legacy payloads can omit per-talent ranks and only include tree splits.
  // At 30+ retribution points, infer max Vengeance rank.
  return VENGEANCE_AURA_BY_RANK.length
}

// ============================================================================
// Configuration
// ============================================================================

/** Exclusive aura sets - only one blessing can be active at a time */
export const exclusiveAuras: Set<number>[] = [
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
      schools: new Set([SpellSchool.Holy]),
    }),

    // Improved Righteous Fury increases RF's holy multiplier.
    [Spells.ImprovedRighteousFuryR1]: (ctx) => ({
      source: 'talent',
      name: 'Improved Righteous Fury (Rank 1)',
      value: ctx.sourceAuras.has(Spells.RighteousFury)
        ? Mods.ImprovedRighteousFuryR1 / Mods.RighteousFury
        : 1,
      schools: new Set([SpellSchool.Holy]),
    }),

    [Spells.ImprovedRighteousFuryR2]: (ctx) => ({
      source: 'talent',
      name: 'Improved Righteous Fury (Rank 2)',
      value: ctx.sourceAuras.has(Spells.RighteousFury)
        ? Mods.ImprovedRighteousFuryR2 / Mods.RighteousFury
        : 1,
      schools: new Set([SpellSchool.Holy]),
    }),

    [Spells.ImprovedRighteousFuryR3]: (ctx) => ({
      source: 'talent',
      name: 'Improved Righteous Fury (Rank 3)',
      value: ctx.sourceAuras.has(Spells.RighteousFury)
        ? Mods.ImprovedRighteousFuryR3 / Mods.RighteousFury
        : 1,
      schools: new Set([SpellSchool.Holy]),
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

  talentImplications: (ctx: TalentImplicationContext) => {
    const syntheticAuras: number[] = []

    const improvedRighteousFuryRank = inferImprovedRighteousFuryRank(ctx)
    if (improvedRighteousFuryRank > 0) {
      syntheticAuras.push(
        IMPROVED_RIGHTEOUS_FURY_AURA_BY_RANK[improvedRighteousFuryRank - 1]!,
      )
    }

    const vengeanceRank = inferVengeanceRank(ctx)
    if (vengeanceRank > 0) {
      syntheticAuras.push(VENGEANCE_AURA_BY_RANK[vengeanceRank - 1]!)
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
