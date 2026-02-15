/**
 * Gruul's Lair raid mechanics for Anniversary/TBC.
 */
import type { ThreatFormula } from '@wcl-threat/shared'

import { createHatefulStrikeFormula } from './hateful-strike'

export const gruulsLairAbilities: Record<number, ThreatFormula> = {
  33813: createHatefulStrikeFormula(1500, 0), // Hurtful Strike
}
