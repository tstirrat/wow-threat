/**
 * Anniversary Naxxramas deltas over Era.
 */
import type { ThreatFormula } from '@wcl-threat/shared'

import { naxxAbilities as eraNaxxAbilities } from '../../era/raids/naxx'
import { createHatefulStrikeFormula } from './hateful-strike'

export const naxxAbilities: Record<number, ThreatFormula> = {
  ...eraNaxxAbilities,
  28308: createHatefulStrikeFormula(1000, 2000), // Patchwerk hateful strike variant
}
