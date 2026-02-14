import type { ThreatFormula } from '@wcl-threat/shared'

import { miscAbilities as eraMisc } from '../era/misc'
import { calculateThreat } from '../shared/formulas'

export const miscAbilities: Record<number, ThreatFormula> = {
  ...eraMisc,
  467271: calculateThreat({ modifier: 2.25, eventTypes: ['damage'] }), // Dragonbreath

  1213816: calculateThreat({ modifier: 2, eventTypes: ['damage'] }), // Razorbramble
  1213813: calculateThreat({ modifier: 2, eventTypes: ['damage'] }), // Razorspike
}
