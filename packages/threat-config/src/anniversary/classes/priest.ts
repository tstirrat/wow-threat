/**
 * Priest Threat Configuration - Anniversary Edition
 *
 * Mind Blast generates extra threat. Silent Resolve and Shadow Affinity talents reduce threat.
 */
import type {
  ClassThreatConfig,
  TalentImplicationContext,
} from '@wcl-threat/shared'
import { SpellSchool } from '@wcl-threat/shared'

import { calculateThreat, noThreat } from '../../shared/formulas'
import { inferMappedTalentRank } from '../../shared/talents'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  // Mind Blast (extra threat per rank)
  MindBlastR1: 8092,
  MindBlastR2: 8102,
  MindBlastR3: 8103,
  MindBlastR4: 8104,
  MindBlastR5: 8105,
  MindBlastR6: 8106,
  MindBlastR7: 10945,
  MindBlastR8: 10946,
  MindBlastR9: 10947,

  // Holy Nova - zero threat
  HolyNovaDmgR1: 15237,
  HolyNovaDmgR2: 15430,
  HolyNovaDmgR3: 15431,
  HolyNovaDmgR4: 27799,
  HolyNovaDmgR5: 27800,
  HolyNovaDmgR6: 27801,
  HolyNovaHealR1: 23455,
  HolyNovaHealR2: 23458,
  HolyNovaHealR3: 23459,
  HolyNovaHealR4: 27803,
  HolyNovaHealR5: 27804,
  HolyNovaHealR6: 27805,

  // Weakened Soul - zero threat
  WeakenedSoul: 6788,

  // Talents (synthetic aura IDs inferred from combatantinfo)
  SilentResolveRank1: 14523,
  SilentResolveRank2: 14784,
  SilentResolveRank3: 14785,
  SilentResolveRank4: 14786,
  SilentResolveRank5: 14787,
  ShadowAffinityRank1: 15318,
  ShadowAffinityRank2: 15319,
  ShadowAffinityRank3: 15320,
} as const

const Mods = {
  SilentResolve: 0.04, // 4% per rank (up to 20%)
  ShadowAffinity: 0.25 / 3, // 8.33% per rank (up to 25%)
}

const SILENT_RESOLVE_AURA_BY_RANK = [
  Spells.SilentResolveRank1,
  Spells.SilentResolveRank2,
  Spells.SilentResolveRank3,
  Spells.SilentResolveRank4,
  Spells.SilentResolveRank5,
] as const
const SHADOW_AFFINITY_AURA_BY_RANK = [
  Spells.ShadowAffinityRank1,
  Spells.ShadowAffinityRank2,
  Spells.ShadowAffinityRank3,
] as const

const SILENT_RESOLVE_RANK_BY_TALENT_ID = new Map<number, number>(
  SILENT_RESOLVE_AURA_BY_RANK.map((spellId, idx) => [spellId, idx + 1]),
)
const SHADOW_AFFINITY_RANK_BY_TALENT_ID = new Map<number, number>(
  SHADOW_AFFINITY_AURA_BY_RANK.map((spellId, idx) => [spellId, idx + 1]),
)

// ============================================================================
// Configuration
// ============================================================================

export const priestConfig: ClassThreatConfig = {
  auraModifiers: {
    // Silent Resolve - all spell threat reduction
    [Spells.SilentResolveRank1]: () => ({
      source: 'talent',
      name: 'Silent Resolve (Rank 1)',
      value: 1 - Mods.SilentResolve,
    }),
    [Spells.SilentResolveRank2]: () => ({
      source: 'talent',
      name: 'Silent Resolve (Rank 2)',
      value: 1 - Mods.SilentResolve * 2,
    }),
    [Spells.SilentResolveRank3]: () => ({
      source: 'talent',
      name: 'Silent Resolve (Rank 3)',
      value: 1 - Mods.SilentResolve * 3,
    }),
    [Spells.SilentResolveRank4]: () => ({
      source: 'talent',
      name: 'Silent Resolve (Rank 4)',
      value: 1 - Mods.SilentResolve * 4,
    }),
    [Spells.SilentResolveRank5]: () => ({
      source: 'talent',
      name: 'Silent Resolve (Rank 5)',
      value: 1 - Mods.SilentResolve * 5,
    }),

    // Shadow Affinity - shadow spell threat reduction
    [Spells.ShadowAffinityRank1]: () => ({
      source: 'talent',
      name: 'Shadow Affinity (Rank 1)',
      value: 1 - Mods.ShadowAffinity,
      schools: new Set([SpellSchool.Shadow]),
    }),
    [Spells.ShadowAffinityRank2]: () => ({
      source: 'talent',
      name: 'Shadow Affinity (Rank 2)',
      value: 1 - Mods.ShadowAffinity * 2,
      schools: new Set([SpellSchool.Shadow]),
    }),
    [Spells.ShadowAffinityRank3]: () => ({
      source: 'talent',
      name: 'Shadow Affinity (Rank 3)',
      value: 1 - Mods.ShadowAffinity * 3,
      schools: new Set([SpellSchool.Shadow]),
    }),
  },

  abilities: {
    // Mind Blast - damage + flat threat per rank
    [Spells.MindBlastR1]: calculateThreat({ modifier: 1, bonus: 40 }),
    [Spells.MindBlastR2]: calculateThreat({ modifier: 1, bonus: 77 }),
    [Spells.MindBlastR3]: calculateThreat({ modifier: 1, bonus: 121 }),
    [Spells.MindBlastR4]: calculateThreat({ modifier: 1, bonus: 180 }),
    [Spells.MindBlastR5]: calculateThreat({ modifier: 1, bonus: 236 }),
    [Spells.MindBlastR6]: calculateThreat({ modifier: 1, bonus: 303 }),
    [Spells.MindBlastR7]: calculateThreat({ modifier: 1, bonus: 380 }),
    [Spells.MindBlastR8]: calculateThreat({ modifier: 1, bonus: 460 }),
    [Spells.MindBlastR9]: calculateThreat({ modifier: 1, bonus: 540 }),

    // Holy Nova - zero threat
    [Spells.HolyNovaDmgR1]: noThreat(),
    [Spells.HolyNovaDmgR2]: noThreat(),
    [Spells.HolyNovaDmgR3]: noThreat(),
    [Spells.HolyNovaDmgR4]: noThreat(),
    [Spells.HolyNovaDmgR5]: noThreat(),
    [Spells.HolyNovaDmgR6]: noThreat(),
    [Spells.HolyNovaHealR1]: noThreat(),
    [Spells.HolyNovaHealR2]: noThreat(),
    [Spells.HolyNovaHealR3]: noThreat(),
    [Spells.HolyNovaHealR4]: noThreat(),
    [Spells.HolyNovaHealR5]: noThreat(),
    [Spells.HolyNovaHealR6]: noThreat(),

    // Weakened Soul - zero threat
    [Spells.WeakenedSoul]: noThreat(),
  },

  talentImplications: (ctx: TalentImplicationContext) => {
    const syntheticAuras: number[] = []

    const silentResolveRank = inferMappedTalentRank(
      ctx.talentRanks,
      SILENT_RESOLVE_RANK_BY_TALENT_ID,
      SILENT_RESOLVE_AURA_BY_RANK.length,
    )
    if (silentResolveRank > 0) {
      syntheticAuras.push(SILENT_RESOLVE_AURA_BY_RANK[silentResolveRank - 1]!)
    }

    const shadowAffinityRank = inferMappedTalentRank(
      ctx.talentRanks,
      SHADOW_AFFINITY_RANK_BY_TALENT_ID,
      SHADOW_AFFINITY_AURA_BY_RANK.length,
    )
    if (shadowAffinityRank > 0) {
      syntheticAuras.push(SHADOW_AFFINITY_AURA_BY_RANK[shadowAffinityRank - 1]!)
    }

    return syntheticAuras
  },
}
