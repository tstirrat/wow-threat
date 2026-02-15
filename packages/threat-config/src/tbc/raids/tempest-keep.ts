/**
 * Tempest Keep raid mechanics for Anniversary/TBC.
 */
import type { ThreatFormula } from '@wcl-threat/shared'

import { modifyThreat, modifyThreatOnHit } from '../../shared/formulas'

export const tempestKeepAbilities: Record<number, ThreatFormula> = {
  33237: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['cast'] }), // High King Maulgar (Kiggler) reset
  37102: modifyThreatOnHit(0.75), // Crystalcore Devastator knock-away
}
