/**
 * Mage Threat Configuration - Season of Discovery
 */
import type { ClassThreatConfig } from '@wow-threat/shared'

import {
  Spells as EraSpells,
  mageConfig as eraMageConfig,
} from '../../era/classes/mage'

export const Spells = {
  ...EraSpells,
  FrostfireBolt: 401502,
} as const

// TODO: verify frost fire bolt is reduced by Burning Soul talent and the ice one

export const mageConfig: ClassThreatConfig = {
  ...eraMageConfig,
}
