/**
 * Tempest Keep raid mechanics for Anniversary/TBC.
 */
import type { Abilities } from '@wow-threat/shared'

import { modifyThreatOnHit } from '../../shared/formulas'

const Spells = {
  KnockAway: 37102, // https://www.wowhead.com/tbc/spell=37102/knock-away
} as const

export const tempestKeepAbilities: Abilities = {
  [Spells.KnockAway]: modifyThreatOnHit(0.75),
}
