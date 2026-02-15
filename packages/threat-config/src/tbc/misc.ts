import type { ThreatFormula } from '@wcl-threat/shared'

import { miscAbilities as eraMisc } from '../era/misc'

export const miscAbilities: Record<number, ThreatFormula> = {
  ...eraMisc,
}
