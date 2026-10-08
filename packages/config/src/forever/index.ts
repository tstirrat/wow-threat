/**
 * WoW Forever Threat Configuration
 *
 * This is a dormant scaffold until Warcraft Logs exposes stable metadata for
 * Forever reports. Era is the closest existing baseline, but inherited rules
 * are provisional and should be audited as Forever mechanics are implemented.
 */
import { eraConfig } from '../era'
import { extendConfig } from '../shared/extend-config'
import { validateAbilities, validateAuraModifiers } from '../shared/utils'
import { foreverDruidConfig } from './classes/druid'
import { foreverPaladinConfig } from './classes/paladin'

/**
 * Keep this resolver disabled until a real WCL Forever report establishes the
 * gameVersion, season ID, partition names, and report host we can match safely.
 */
const resolveForeverReport = (): boolean => false

export const foreverConfig = extendConfig(eraConfig, {
  version: 2,
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
