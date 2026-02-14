/**
 * Anniversary class wrapper for warrior.
 *
 * Defaults to Era behavior until Anniversary-specific overrides are needed.
 */
import type { ClassThreatConfig } from '@wcl-threat/shared'

import {
  SetIds as EraSetIds,
  Spells as EraSpells,
  warriorConfig as eraWarriorConfig,
} from '../../era/classes/warrior'
import { threatOnCastRollbackOnMiss } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  SunderArmorR6: 25225, // https://wowhead.com/tbc/spell=25225/
}

export const SetIds = {
  ...EraSetIds,
}

export const warriorConfig: ClassThreatConfig = {
  ...eraWarriorConfig,

  abilities: {
    ...eraWarriorConfig.abilities,
    [Spells.SunderArmorR6]: threatOnCastRollbackOnMiss(301),
  },
}
