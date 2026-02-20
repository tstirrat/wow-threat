/**
 * Season of Discovery Class Threat Configs
 */
import type { ThreatConfig } from '@wow-threat/shared'

import { druidConfig } from './druid'
import { hunterConfig } from './hunter'
import { mageConfig } from './mage'
import { paladinConfig } from './paladin'
import { priestConfig } from './priest'
import { rogueConfig } from './rogue'
import { shamanConfig } from './shaman'
import { warlockConfig } from './warlock'
import { warriorConfig } from './warrior'

export const sodClasses: ThreatConfig['classes'] = {
  warrior: warriorConfig,
  paladin: paladinConfig,
  druid: druidConfig,
  priest: priestConfig,
  rogue: rogueConfig,
  hunter: hunterConfig,
  mage: mageConfig,
  warlock: warlockConfig,
  shaman: shamanConfig,
}
