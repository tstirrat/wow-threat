/**
 * Shared TBC raid mechanics used across multiple raids.
 */
import type { Abilities } from '@wow-threat/shared'

import { modifyThreatOnHit } from '../../shared/formulas'

export const commonRaidAbilities: Abilities = {
  // Generic knock-away style 50% threat drops
  10101: modifyThreatOnHit(0.5),
  18813: modifyThreatOnHit(0.5),
  18945: modifyThreatOnHit(0.5),
  20686: modifyThreatOnHit(0.5),
  23382: modifyThreatOnHit(0.5),
  30121: modifyThreatOnHit(0.5),
  32077: modifyThreatOnHit(0.5),
  32959: modifyThreatOnHit(0.5),
  37597: modifyThreatOnHit(0.5),

  // Generic heavy knock-away style 75% threat drops
  25778: modifyThreatOnHit(0.75),
  31389: modifyThreatOnHit(0.75),
}
