/**
 * Molten Core Abilities - Season of Discovery
 */
import type { ThreatFormula } from '@wow-threat/shared'

import { modifyThreat } from '../../shared/formulas'

export const mcAbilities: Record<number, ThreatFormula> = {
  20534: modifyThreat({ modifier: 0, eventTypes: ['cast'] }), // Majordomo Teleport
  20566: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['cast'] }), // Wrath of Ragnaros
  23138: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['cast'] }), // Gate of Shazzrah
}
