/**
 * Anniversary rogue deltas over Era.
 */
import type { ClassThreatConfig } from '@wcl-threat/shared'

import {
  Spells as EraSpells,
  rogueConfig as eraRogueConfig,
} from '../../era/classes/rogue'
import { modifyThreat } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  VanishR3: 26889,
} as const

export const rogueConfig: ClassThreatConfig = {
  ...eraRogueConfig,
  abilities: {
    ...eraRogueConfig.abilities,
    [Spells.VanishR3]: modifyThreat({ modifier: 0, target: 'all' }),
  },
}
