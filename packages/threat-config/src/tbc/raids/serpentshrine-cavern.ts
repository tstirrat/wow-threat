/**
 * Serpentshrine Cavern raid mechanics for Anniversary/TBC.
 */
import type { ThreatFormula } from '@wcl-threat/shared'

import { modifyThreat } from '../../shared/formulas'

export const serpentshrineCavernAbilities: Record<number, ThreatFormula> = {
  25035: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['cast'] }), // Hydross phase swap
  37640: modifyThreat({
    modifier: 0,
    target: 'all',
    eventTypes: ['applybuff', 'removebuff'],
  }), // Leotheras whirlwind reset
  38112: modifyThreat({
    modifier: 0,
    target: 'all',
    eventTypes: ['applybuff', 'removebuff'],
  }), // Lady Vashj barrier reset
}
