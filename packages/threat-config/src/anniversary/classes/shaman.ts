/**
 * Shaman Threat Configuration - Anniversary Edition
 *
 * Earth Shock has 2x threat. Tranquil Air Totem reduces party threat.
 */
import { calculateThreat } from '../../shared/formulas'
import type { ClassThreatConfig } from '../../types'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  TranquilAirTotem: 25909,
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

    // TODO: [Healing Grace] Talent - 5% per rank healing threat reduction
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
}
