import type { ThreatFormula } from '@wow-threat/shared'

import { miscAbilities as eraMisc } from '../era/misc'
import { threat } from '../shared/formulas'

export const miscAbilities: Record<number, ThreatFormula> = {
  ...eraMisc,
  467271: threat({ modifier: 2.25, eventTypes: ['damage'] }), // Dragonbreath

  1213816: threat({ modifier: 2, eventTypes: ['damage'] }), // Razorbramble
  1213813: threat({ modifier: 2, eventTypes: ['damage'] }), // Razorspike
}
