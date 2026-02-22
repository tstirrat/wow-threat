/**
 * Mage Threat Configuration - Anniversary Edition
 *
 * Mages have talent-based threat reduction. Ice Block grants invulnerability.
 */
import type {
  ClassThreatConfig,
  SpellId,
  TalentImplicationContext,
} from '@wow-threat/shared'
import { SpellSchool } from '@wow-threat/shared'

import { inferTalent } from '../../shared/talents'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  IceBlock: 11958, // https://www.wowhead.com/classic/spell=11958/

  // Talents (synthetic aura IDs inferred from combatantinfo)
  ArcaneSubtletyRank1: 11210, // https://www.wowhead.com/classic/spell=11210/
  ArcaneSubtletyRank2: 12592, // https://www.wowhead.com/classic/spell=12592/
  BurningSoulRank1: 11083, // https://www.wowhead.com/classic/spell=11083/
  BurningSoulRank2: 12351, // https://www.wowhead.com/classic/spell=12351/
  FrostChannelingRank1: 11160, // https://www.wowhead.com/classic/spell=11160/
  FrostChannelingRank2: 12518, // https://www.wowhead.com/classic/spell=12518/
  FrostChannelingRank3: 12519, // https://www.wowhead.com/classic/spell=12519/

  // Polymorph (various forms) - causes aggro loss
  PolymorphR1: 118, // https://www.wowhead.com/classic/spell=118/
  PolymorphR2: 12824, // https://www.wowhead.com/classic/spell=12824/
  PolymorphR3: 12825, // https://www.wowhead.com/classic/spell=12825/
  PolymorphPig: 28272, // https://www.wowhead.com/classic/spell=28272/
  PolymorphTurtle: 28271, // https://www.wowhead.com/classic/spell=28271/
  PolymorphR4: 12826, // https://www.wowhead.com/classic/spell=12826/
} as const

// ============================================================================
// Modifiers
// ============================================================================

export const Mods = {
  BurningSoul: 0.15, // 15% per rank (up to 30%)
  FrostChanneling: 0.1, // 10% per rank (up to 30%)
  ArcaneSubtlety: 0.2, // 20% per rank (up to 40%)
}

const ARCANE_SUBTLETY_RANKS = [
  Spells.ArcaneSubtletyRank1,
  Spells.ArcaneSubtletyRank2,
] as const
const BURNING_SOUL_RANKS = [
  Spells.BurningSoulRank1,
  Spells.BurningSoulRank2,
] as const
const FROST_CHANNELING_RANKS = [
  Spells.FrostChannelingRank1,
  Spells.FrostChannelingRank2,
  Spells.FrostChannelingRank3,
] as const

const FIRE = 1
const BURNING_SOUL_THRESHOLD = 12

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
      schoolMask: SpellSchool.Arcane,
    }),
    [Spells.ArcaneSubtletyRank2]: () => ({
      source: 'talent',
      name: 'Arcane Subtlety (Rank 2)',
      value: 1 - Mods.ArcaneSubtlety * 2,
      schoolMask: SpellSchool.Arcane,
    }),

    // Burning Soul - Fire spell threat reduction
    [Spells.BurningSoulRank1]: () => ({
      source: 'talent',
      name: 'Burning Soul (Rank 1)',
      value: 1 - Mods.BurningSoul,
      schoolMask: SpellSchool.Fire,
    }),
    [Spells.BurningSoulRank2]: () => ({
      source: 'talent',
      name: 'Burning Soul (Rank 2)',
      value: 1 - Mods.BurningSoul * 2,
      schoolMask: SpellSchool.Fire,
    }),

    // Frost Channeling - Frost spell threat reduction
    [Spells.FrostChannelingRank1]: () => ({
      source: 'talent',
      name: 'Frost Channeling (Rank 1)',
      value: 1 - Mods.FrostChanneling,
      schoolMask: SpellSchool.Frost,
    }),
    [Spells.FrostChannelingRank2]: () => ({
      source: 'talent',
      name: 'Frost Channeling (Rank 2)',
      value: 1 - Mods.FrostChanneling * 2,
      schoolMask: SpellSchool.Frost,
    }),
    [Spells.FrostChannelingRank3]: () => ({
      source: 'talent',
      name: 'Frost Channeling (Rank 3)',
      value: 1 - Mods.FrostChanneling * 3,
      schoolMask: SpellSchool.Frost,
    }),
  },

  abilities: {
    // Ice Block is handled as invulnerability buff, not here
  },

  talentImplications: (ctx: TalentImplicationContext) => {
    const syntheticAuras: SpellId[] = []

    const arcaneSubtletySpellId = inferTalent(ctx, ARCANE_SUBTLETY_RANKS)
    if (arcaneSubtletySpellId) {
      syntheticAuras.push(arcaneSubtletySpellId)
    }

    const burningSoulSpellId = inferTalent(ctx, BURNING_SOUL_RANKS, (points) =>
      points[FIRE] >= BURNING_SOUL_THRESHOLD ? 2 : 0,
    )
    if (burningSoulSpellId) {
      syntheticAuras.push(burningSoulSpellId)
    }

    const frostChannelingSpellId = inferTalent(ctx, FROST_CHANNELING_RANKS)
    if (frostChannelingSpellId) {
      syntheticAuras.push(frostChannelingSpellId)
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
