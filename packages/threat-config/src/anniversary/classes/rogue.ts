/**
 * Rogue Threat Configuration - Anniversary Edition
 *
 * Rogues have a base 0.71x threat coefficient for all actions.
 */
import type { ClassThreatConfig } from '@wcl-threat/shared'

import { calculateThreat, modifyThreat } from '../../shared/formulas'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  VanishR1: 1856,
  VanishR2: 1857,
  FeintR1: 1966,
  FeintR2: 6768,
  FeintR3: 8637,
  FeintR4: 11303,
  FeintR5: 25302,
} as const

// ============================================================================
// Modifiers
// ============================================================================

const Mods = {
  Base: 0.71,
}

// ============================================================================
// Configuration
// ============================================================================

export const rogueConfig: ClassThreatConfig = {
  baseThreatFactor: Mods.Base,

  auraModifiers: {},

  abilities: {
    // Vanish - threat drop
    [Spells.VanishR1]: modifyThreat({ modifier: 0, target: 'all' }),
    [Spells.VanishR2]: modifyThreat({ modifier: 0, target: 'all' }),

    // Feint - negative threat (no coefficient applied)
    [Spells.FeintR1]: calculateThreat({ modifier: 0, bonus: -150 }),
    [Spells.FeintR2]: calculateThreat({ modifier: 0, bonus: -240 }),
    [Spells.FeintR3]: calculateThreat({ modifier: 0, bonus: -390 }),
    [Spells.FeintR4]: calculateThreat({ modifier: 0, bonus: -600 }),
    [Spells.FeintR5]: calculateThreat({ modifier: 0, bonus: -800 }),
  },
}
