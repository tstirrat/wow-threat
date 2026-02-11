/**
 * Shaman Threat Configuration - Anniversary Edition
 *
 * Earth Shock has 2x threat. Tranquil Air Totem reduces party threat.
 */
import type {
  ClassThreatConfig,
  TalentImplicationContext,
} from '@wcl-threat/shared'

import { calculateThreat } from '../../shared/formulas'
import { inferMappedTalentRank } from '../../shared/talents'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  TranquilAirTotem: 25909,
  HealingGraceRank1: 29187,
  HealingGraceRank2: 29189,
  HealingGraceRank3: 29191,
  EarthShockR1: 8042,
  EarthShockR2: 8044,
  EarthShockR3: 8045,
  EarthShockR4: 8046,
  EarthShockR5: 10412,
  EarthShockR6: 10413,
  EarthShockR7: 10414,
} as const

// ============================================================================
// Modifiers
// ============================================================================

const Mods = {
  EarthShock: 2.0,
  TranquilAirTotem: 0.8,
  HealingGrace: 0.05, // 5% per rank
}

const HEALING_GRACE_AURA_BY_RANK = [
  Spells.HealingGraceRank1,
  Spells.HealingGraceRank2,
  Spells.HealingGraceRank3,
] as const

const HEALING_GRACE_RANK_BY_TALENT_ID = new Map<number, number>(
  HEALING_GRACE_AURA_BY_RANK.map((spellId, idx) => [spellId, idx + 1]),
)

const HEALING_SPELLS = new Set([
  8004,
  8008,
  8010,
  10466,
  10467,
  10468, // Lesser Healing Wave
  331,
  332,
  547,
  913,
  939,
  959,
  8005,
  10395,
  10396,
  25357, // Healing Wave
  1064,
  10622,
  10623, // Chain Heal
])

// ============================================================================
// Configuration
// ============================================================================

export const shamanConfig: ClassThreatConfig = {
  auraModifiers: {
    // Tranquil Air Totem - 0.8x threat for party
    [Spells.TranquilAirTotem]: () => ({
      source: 'aura',
      name: 'Tranquil Air Totem',

      value: Mods.TranquilAirTotem,
    }),

    // Healing Grace - healing spell threat reduction
    [Spells.HealingGraceRank1]: () => ({
      source: 'talent',
      name: 'Healing Grace (Rank 1)',
      spellIds: HEALING_SPELLS,
      value: 1 - Mods.HealingGrace,
    }),
    [Spells.HealingGraceRank2]: () => ({
      source: 'talent',
      name: 'Healing Grace (Rank 2)',
      spellIds: HEALING_SPELLS,
      value: 1 - Mods.HealingGrace * 2,
    }),
    [Spells.HealingGraceRank3]: () => ({
      source: 'talent',
      name: 'Healing Grace (Rank 3)',
      spellIds: HEALING_SPELLS,
      value: 1 - Mods.HealingGrace * 3,
    }),
  },

  abilities: {
    // Earth Shock - 2x threat
    [Spells.EarthShockR1]: calculateThreat({ modifier: Mods.EarthShock }),
    [Spells.EarthShockR2]: calculateThreat({ modifier: Mods.EarthShock }),
    [Spells.EarthShockR3]: calculateThreat({ modifier: Mods.EarthShock }),
    [Spells.EarthShockR4]: calculateThreat({ modifier: Mods.EarthShock }),
    [Spells.EarthShockR5]: calculateThreat({ modifier: Mods.EarthShock }),
    [Spells.EarthShockR6]: calculateThreat({ modifier: Mods.EarthShock }),
    [Spells.EarthShockR7]: calculateThreat({ modifier: Mods.EarthShock }),
  },

  talentImplications: (ctx: TalentImplicationContext) => {
    const healingGraceRank = inferMappedTalentRank(
      ctx.talentRanks,
      HEALING_GRACE_RANK_BY_TALENT_ID,
      HEALING_GRACE_AURA_BY_RANK.length,
    )
    if (healingGraceRank === 0) {
      return []
    }
    return [HEALING_GRACE_AURA_BY_RANK[healingGraceRank - 1]!]
  },
}
