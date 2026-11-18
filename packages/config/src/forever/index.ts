/**
 * WoW Forever Threat Configuration
 *
 * Activated for WCL gameVersion 7 (forever.warcraftlogs.com). Forever reports
 * carry no zone, classic season, or partition metadata, so gameVersion alone
 * identifies them. Era is the closest existing baseline, but inherited rules
 * are provisional and should be audited as Forever mechanics are implemented.
 */
import type { ThreatConfigResolutionInput } from '@wow-threat/shared'

import { eraConfig } from '../era'
import { extendConfig } from '../shared/extend-config'
import {
  FOREVER_GAME_VERSION,
  validateAbilities,
  validateAuraModifiers,
} from '../shared/utils'
import { foreverDruidConfig } from './classes/druid'
import { foreverPaladinConfig } from './classes/paladin'

/** Forever reports are identified by their WCL gameVersion alone. */
const resolveForeverReport = (input: ThreatConfigResolutionInput): boolean =>
  input.report.masterData.gameVersion === FOREVER_GAME_VERSION

export const foreverConfig = extendConfig(eraConfig, {
  version: 3,
  displayName: 'WoW Forever',
  wowhead: {
    domain: 'forever',
  },
  resolve: resolveForeverReport,
  classes: {
    ...eraConfig.classes,
    druid: foreverDruidConfig,
    paladin: foreverPaladinConfig,
  },
})

validateAuraModifiers(foreverConfig)
validateAbilities(foreverConfig)
