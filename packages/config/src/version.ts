/**
 * Shared threat-config cache version helpers.
 *
 * Cache-busting for events is derived from all top-level config versions so
 * bumping any config version invalidates immutable event responses.
 */
import { eraConfig } from './era'
import { foreverConfig } from './forever'
import { sodConfig } from './sod'
import { tbcConfig } from './tbc'

export const configVersionVector = {
  era: eraConfig.version,
  sod: sodConfig.version,
  anniversary: tbcConfig.version,
  forever: foreverConfig.version,
} as const

/**
 * Shared cache tag used by API/web for immutable event responses.
 *
 * Concatenate in fixed order: era + sod + anniversary + Forever.
 */
export const configCacheVersion = [
  String(configVersionVector.era),
  String(configVersionVector.sod),
  String(configVersionVector.anniversary),
  String(configVersionVector.forever),
].join('')
