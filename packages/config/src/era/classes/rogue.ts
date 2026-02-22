/**
 * Rogue Threat Configuration - Anniversary Edition
 *
 * Rogues have a base 0.71x threat coefficient for all actions.
 */
import type { ClassThreatConfig } from '@wow-threat/shared'

import { modifyThreat, threat } from '../../shared/formulas'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  VanishR1: 1856, // https://www.wowhead.com/classic/spell=1856/
  VanishR2: 1857, // https://www.wowhead.com/classic/spell=1857/
  FeintR1: 1966, // https://www.wowhead.com/classic/spell=1966/
  FeintR2: 6768, // https://www.wowhead.com/classic/spell=6768/
  FeintR3: 8637, // https://www.wowhead.com/classic/spell=8637/
  FeintR4: 11303, // https://www.wowhead.com/classic/spell=11303/
  FeintR5: 25302, // https://www.wowhead.com/classic/spell=25302/
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
    [Spells.FeintR1]: threat({
      modifier: 0,
      bonus: -150,
      applyPlayerMultipliers: false,
    }),
    [Spells.FeintR2]: threat({
      modifier: 0,
      bonus: -240,
      applyPlayerMultipliers: false,
    }),
    [Spells.FeintR3]: threat({
      modifier: 0,
      bonus: -390,
      applyPlayerMultipliers: false,
    }),
    [Spells.FeintR4]: threat({
      modifier: 0,
      bonus: -600,
      applyPlayerMultipliers: false,
    }),
    [Spells.FeintR5]: threat({
      modifier: 0,
      bonus: -800,
      applyPlayerMultipliers: false,
    }),
  },
}
