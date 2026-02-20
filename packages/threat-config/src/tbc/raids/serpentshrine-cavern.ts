/**
 * Serpentshrine Cavern raid mechanics for Anniversary/TBC.
 */
import type { Abilities } from '@wow-threat/shared'

import { modifyThreat } from '../../shared/formulas'

const Spells = {
  HydrossPhaseSwap: 25035, // https://www.wowhead.com/tbc/spell=25035/elemental-spawn-in
  LeotherasWhirlwind: 37640, // https://www.wowhead.com/tbc/spell=37640/whirlwind
  LadyVashjBarrier: 38112, // https://www.wowhead.com/tbc/spell=38112/magic-barrier
} as const

export const serpentshrineCavernAbilities: Abilities = {
  [Spells.HydrossPhaseSwap]: modifyThreat({
    modifier: 0,
    target: 'all',
    eventTypes: ['cast'],
  }),
  [Spells.LeotherasWhirlwind]: modifyThreat({
    modifier: 0,
    target: 'all',
    eventTypes: ['applybuff', 'removebuff'],
  }),
  [Spells.LadyVashjBarrier]: modifyThreat({
    modifier: 0,
    target: 'all',
    eventTypes: ['applybuff', 'removebuff'],
  }),
}
