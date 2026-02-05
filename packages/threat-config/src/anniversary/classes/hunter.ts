/**
 * Hunter Threat Configuration - Anniversary Edition
 *
 * Feign Death drops threat. Distracting Shot generates fixed threat.
 */

import type { ClassThreatConfig } from '../../types'
import { calculateThreat, modifyThreat } from '../../shared/formulas'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  FeignDeath: 5384,
  DistractingShotR1: 20736,
  DistractingShotR2: 14274,
  DistractingShotR3: 15629,
  DistractingShotR4: 15630,
  DistractingShotR5: 15631,
  DistractingShotR6: 15632,
  DisengageR1: 781,
  DisengageR2: 14272,
  DisengageR3: 14273,
} as const

// ============================================================================
// Configuration
// ============================================================================

export const hunterConfig: ClassThreatConfig = {
  auraModifiers: {},

  abilities: {
    // Feign Death - threat drop
    [Spells.FeignDeath]: modifyThreat(0),

    // Distracting Shot - damage + flat threat per rank
    [Spells.DistractingShotR1]: calculateThreat({ modifier: 1, bonus: 110 }),
    [Spells.DistractingShotR2]: calculateThreat({ modifier: 1, bonus: 160 }),
    [Spells.DistractingShotR3]: calculateThreat({ modifier: 1, bonus: 250 }),
    [Spells.DistractingShotR4]: calculateThreat({ modifier: 1, bonus: 350 }),
    [Spells.DistractingShotR5]: calculateThreat({ modifier: 1, bonus: 465 }),
    [Spells.DistractingShotR6]: calculateThreat({ modifier: 1, bonus: 600 }),

    // Disengage - negative threat
    [Spells.DisengageR1]: calculateThreat({ modifier: 0, bonus: -140 }),
    [Spells.DisengageR2]: calculateThreat({ modifier: 0, bonus: -280 }),
    [Spells.DisengageR3]: calculateThreat({ modifier: 0, bonus: -405 }),
  },
}
