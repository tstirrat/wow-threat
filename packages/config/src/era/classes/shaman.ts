/**
 * Shaman Threat Configuration - Anniversary Edition
 *
 * Earth Shock has 2x threat. Tranquil Air Totem reduces party threat.
 */
import type {
  ClassThreatConfig,
  TalentImplicationContext,
} from '@wow-threat/shared'

import { threat } from '../../shared/formulas'
import { inferTalent } from '../../shared/talents'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  TranquilAirBuff: 25909, // https://www.wowhead.com/classic/spell=25909/
  TranquilAirTotem: 25908, // https://www.wowhead.com/classic/spell=25908/
  HealingGraceRank1: 29187, // https://www.wowhead.com/classic/spell=29187/
  HealingGraceRank2: 29189, // https://www.wowhead.com/classic/spell=29189/
  HealingGraceRank3: 29191, // https://www.wowhead.com/classic/spell=29191/
  EarthShockR1: 8042, // https://www.wowhead.com/classic/spell=8042/
  EarthShockR2: 8044, // https://www.wowhead.com/classic/spell=8044/
  EarthShockR3: 8045, // https://www.wowhead.com/classic/spell=8045/
  EarthShockR4: 8046, // https://www.wowhead.com/classic/spell=8046/
  EarthShockR5: 10412, // https://www.wowhead.com/classic/spell=10412/
  EarthShockR6: 10413, // https://www.wowhead.com/classic/spell=10413/
  EarthShockR7: 10414, // https://www.wowhead.com/classic/spell=10414/
} as const

// ============================================================================
// Modifiers
// ============================================================================

const Mods = {
  EarthShock: 2.0,
  TranquilAirTotem: 0.8,
  HealingGrace: 0.05, // 5% per rank
}

const HEALING_GRACE_RANKS = [
  Spells.HealingGraceRank1,
  Spells.HealingGraceRank2,
  Spells.HealingGraceRank3,
] as const

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
    // WCL never returns this buff
    [Spells.TranquilAirBuff]: () => ({
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
    [Spells.EarthShockR1]: threat({ modifier: Mods.EarthShock }),
    [Spells.EarthShockR2]: threat({ modifier: Mods.EarthShock }),
    [Spells.EarthShockR3]: threat({ modifier: Mods.EarthShock }),
    [Spells.EarthShockR4]: threat({ modifier: Mods.EarthShock }),
    [Spells.EarthShockR5]: threat({ modifier: Mods.EarthShock }),
    [Spells.EarthShockR6]: threat({ modifier: Mods.EarthShock }),
    [Spells.EarthShockR7]: threat({ modifier: Mods.EarthShock }),

    [Spells.TranquilAirTotem]: (ctx) => {
      if (ctx.event.type === 'summon') {
        // adds a marker on the chart only
        return {
          value: 0,
          splitAmongEnemies: false,
          note: 'tranquilAirTotem(summonMarker)',
          effects: [{ type: 'eventMarker', marker: 'tranquilAirTotem' }],
        }
      }
      return undefined
    },
  },

  talentImplications: (ctx: TalentImplicationContext) => {
    const healingGraceSpellId = inferTalent(ctx, HEALING_GRACE_RANKS)
    if (healingGraceSpellId) {
      return [healingGraceSpellId]
    }
    return []
  },
}
