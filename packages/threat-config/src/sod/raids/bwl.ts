/**
 * Blackwing Lair Abilities - Season of Discovery
 */
import type { ThreatFormula } from '@wow-threat/shared'

import { bwlAbilities as eraBwlAbilities } from '../../era/raids/bwl'

export const bwlAbilities: Record<number, ThreatFormula> = {
  ...eraBwlAbilities,
}
