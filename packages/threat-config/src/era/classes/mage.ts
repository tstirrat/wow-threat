/**
 * Mage Threat Configuration - Anniversary Edition
 *
 * Mages have talent-based threat reduction. Ice Block grants invulnerability.
 */
import type {
  ClassThreatConfig,
  TalentImplicationContext,
} from '@wcl-threat/shared'
import { SpellSchool } from '@wcl-threat/shared'

import { inferMappedTalentRank } from '../../shared/talents'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  IceBlock: 11958,

  // Talents (synthetic aura IDs inferred from combatantinfo)
  ArcaneSubtletyRank1: 11210,
  ArcaneSubtletyRank2: 12592,
  BurningSoulRank1: 11083,
  BurningSoulRank2: 12351,
  FrostChannelingRank1: 11160,
  FrostChannelingRank2: 12518,
  FrostChannelingRank3: 12519,

  // Polymorph (various forms) - causes aggro loss
  PolymorphR1: 118,
  PolymorphR2: 12824,
  PolymorphR3: 12825,
  PolymorphPig: 28272,
  PolymorphTurtle: 28271,
  PolymorphR4: 12826,
} as const

// ============================================================================
// Modifiers
// ============================================================================

const Mods = {
  BurningSoul: 0.05, // 5% per rank (up to 10%)
  FrostChanneling: 0.1, // 10% per rank (up to 30%)
  ArcaneSubtlety: 0.2, // 20% per rank (up to 40%)
}

const ARCANE_SUBTLETY_AURA_BY_RANK = [
  Spells.ArcaneSubtletyRank1,
  Spells.ArcaneSubtletyRank2,
] as const
const BURNING_SOUL_AURA_BY_RANK = [
  Spells.BurningSoulRank1,
  Spells.BurningSoulRank2,
] as const
const FROST_CHANNELING_AURA_BY_RANK = [
  Spells.FrostChannelingRank1,
  Spells.FrostChannelingRank2,
  Spells.FrostChannelingRank3,
] as const

const ARCANE_SUBTLETY_RANK_BY_TALENT_ID = new Map<number, number>(
  ARCANE_SUBTLETY_AURA_BY_RANK.map((spellId, idx) => [spellId, idx + 1]),
)
const BURNING_SOUL_RANK_BY_TALENT_ID = new Map<number, number>(
  BURNING_SOUL_AURA_BY_RANK.map((spellId, idx) => [spellId, idx + 1]),
)
const FROST_CHANNELING_RANK_BY_TALENT_ID = new Map<number, number>(
  FROST_CHANNELING_AURA_BY_RANK.map((spellId, idx) => [spellId, idx + 1]),
)
const FIRE_TREE_INDEX = 1
const BURNING_SOUL_FIRE_POINTS_THRESHOLD = 12

function inferBurningSoulRank(ctx: TalentImplicationContext): number {
  const fromRankMap = inferMappedTalentRank(
    ctx.talentRanks,
    BURNING_SOUL_RANK_BY_TALENT_ID,
    BURNING_SOUL_AURA_BY_RANK.length,
  )
  if (fromRankMap > 0) {
    return fromRankMap
  }

  const firePoints = Math.trunc(ctx.talentPoints[FIRE_TREE_INDEX] ?? 0)
  if (firePoints < BURNING_SOUL_FIRE_POINTS_THRESHOLD) {
    return 0
  }

  // Legacy payloads can omit per-talent ranks and only include tree splits.
  // At 12+ fire points, infer max Burning Soul rank as a fire-mage heuristic.
  return BURNING_SOUL_AURA_BY_RANK.length
}

// ============================================================================
// Configuration
// ============================================================================

export const mageConfig: ClassThreatConfig = {
  auraModifiers: {
    // Arcane Subtlety - Arcane spell threat reduction
    [Spells.ArcaneSubtletyRank1]: () => ({
      source: 'talent',
      name: 'Arcane Subtlety (Rank 1)',
      value: 1 - Mods.ArcaneSubtlety,
      schools: new Set([SpellSchool.Arcane]),
    }),
    [Spells.ArcaneSubtletyRank2]: () => ({
      source: 'talent',
      name: 'Arcane Subtlety (Rank 2)',
      value: 1 - Mods.ArcaneSubtlety * 2,
      schools: new Set([SpellSchool.Arcane]),
    }),

    // Burning Soul - Fire spell threat reduction
    [Spells.BurningSoulRank1]: () => ({
      source: 'talent',
      name: 'Burning Soul (Rank 1)',
      value: 1 - Mods.BurningSoul,
      schools: new Set([SpellSchool.Fire]),
    }),
    [Spells.BurningSoulRank2]: () => ({
      source: 'talent',
      name: 'Burning Soul (Rank 2)',
      value: 1 - Mods.BurningSoul * 2,
      schools: new Set([SpellSchool.Fire]),
    }),

    // Frost Channeling - Frost spell threat reduction
    [Spells.FrostChannelingRank1]: () => ({
      source: 'talent',
      name: 'Frost Channeling (Rank 1)',
      value: 1 - Mods.FrostChanneling,
      schools: new Set([SpellSchool.Frost]),
    }),
    [Spells.FrostChannelingRank2]: () => ({
      source: 'talent',
      name: 'Frost Channeling (Rank 2)',
      value: 1 - Mods.FrostChanneling * 2,
      schools: new Set([SpellSchool.Frost]),
    }),
    [Spells.FrostChannelingRank3]: () => ({
      source: 'talent',
      name: 'Frost Channeling (Rank 3)',
      value: 1 - Mods.FrostChanneling * 3,
      schools: new Set([SpellSchool.Frost]),
    }),
  },

  abilities: {
    // Ice Block is handled as invulnerability buff, not here
  },

  talentImplications: (ctx: TalentImplicationContext) => {
    const syntheticAuras: number[] = []

    const arcaneSubtletyRank = inferMappedTalentRank(
      ctx.talentRanks,
      ARCANE_SUBTLETY_RANK_BY_TALENT_ID,
      ARCANE_SUBTLETY_AURA_BY_RANK.length,
    )
    if (arcaneSubtletyRank > 0) {
      syntheticAuras.push(ARCANE_SUBTLETY_AURA_BY_RANK[arcaneSubtletyRank - 1]!)
    }

    const burningSoulRank = inferBurningSoulRank(ctx)
    if (burningSoulRank > 0) {
      syntheticAuras.push(BURNING_SOUL_AURA_BY_RANK[burningSoulRank - 1]!)
    }

    const frostChannelingRank = inferMappedTalentRank(
      ctx.talentRanks,
      FROST_CHANNELING_RANK_BY_TALENT_ID,
      FROST_CHANNELING_AURA_BY_RANK.length,
    )
    if (frostChannelingRank > 0) {
      syntheticAuras.push(
        FROST_CHANNELING_AURA_BY_RANK[frostChannelingRank - 1]!,
      )
    }

    return syntheticAuras
  },

  aggroLossBuffs: new Set([
    Spells.PolymorphR1,
    Spells.PolymorphR2,
    Spells.PolymorphR3,
    Spells.PolymorphPig,
    Spells.PolymorphTurtle,
    Spells.PolymorphR4,
  ]),

  invulnerabilityBuffs: new Set([Spells.IceBlock]),
}
