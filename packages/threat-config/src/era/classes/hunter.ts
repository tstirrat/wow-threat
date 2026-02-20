/**
 * Hunter Threat Configuration - Era
 *
 * Feign Death drops threat. Distracting Shot generates fixed threat.
 */
import type { ClassThreatConfig } from '@wow-threat/shared'

import { modifyThreat, threat } from '../../shared/formulas'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  FeignDeath: 5384, // https://www.wowhead.com/classic/spell=5384/
  DistractingShotR1: 20736, // https://www.wowhead.com/classic/spell=20736/
  DistractingShotR2: 14274, // https://www.wowhead.com/classic/spell=14274/
  DistractingShotR3: 15629, // https://www.wowhead.com/classic/spell=15629/
  DistractingShotR4: 15630, // https://www.wowhead.com/classic/spell=15630/
  DistractingShotR5: 15631, // https://www.wowhead.com/classic/spell=15631/
  DistractingShotR6: 15632, // https://www.wowhead.com/classic/spell=15632/
  DisengageR1: 781, // https://www.wowhead.com/classic/spell=781/
  DisengageR2: 14272, // https://www.wowhead.com/classic/spell=14272/
  DisengageR3: 14273, // https://www.wowhead.com/classic/spell=14273/
} as const

// ============================================================================
// Configuration
// ============================================================================

export const hunterConfig: ClassThreatConfig = {
  auraModifiers: {},

  abilities: {
    // Feign Death - doesn't actually show in events, and the "death" causes a threat wipe
    [Spells.FeignDeath]: modifyThreat({ modifier: 0, target: 'all' }),

    // Distracting Shot - damage + flat threat per rank
    [Spells.DistractingShotR1]: threat({
      modifier: 1,
      bonus: 110,
      eventTypes: ['cast'],
    }),
    [Spells.DistractingShotR2]: threat({
      modifier: 1,
      bonus: 160,
      eventTypes: ['cast'],
    }),
    [Spells.DistractingShotR3]: threat({
      modifier: 1,
      bonus: 250,
      eventTypes: ['cast'],
    }),
    [Spells.DistractingShotR4]: threat({
      modifier: 1,
      bonus: 350,
      eventTypes: ['cast'],
    }),
    [Spells.DistractingShotR5]: threat({
      modifier: 1,
      bonus: 465,
      eventTypes: ['cast'],
    }),
    [Spells.DistractingShotR6]: threat({
      modifier: 1,
      bonus: 600,
      eventTypes: ['cast'],
    }),

    // Disengage - negative threat
    [Spells.DisengageR1]: threat({ modifier: 0, bonus: -140 }),
    [Spells.DisengageR2]: threat({ modifier: 0, bonus: -280 }),
    [Spells.DisengageR3]: threat({ modifier: 0, bonus: -405 }),
  },
}
