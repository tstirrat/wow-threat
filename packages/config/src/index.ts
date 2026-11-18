/**
 * Threat Configuration Package
 *
 * Exports config resolvers and shared threat calculation utilities.
 */
import { CLASSIC_GAME_VERSIONS, FOREVER_GAME_VERSION } from './shared/utils'

/**
 * Get all supported game versions
 */
export function getSupportedGameVersions(): number[] {
  // Resolver supports WCL classic-era variants via metadata, plus Forever.
  return [...CLASSIC_GAME_VERSIONS, FOREVER_GAME_VERSION]
}

export { resolveConfig, resolveConfigOrNull } from './config-resolver'
export {
  getThreatConfigById,
  parseThreatConfigId,
  threatConfigIds,
} from './threat-config-catalog'
export type { ThreatConfigId } from './threat-config-catalog'
export { configCacheVersion, configVersionVector } from './version'

// Re-export types
export * from './shared/formulas'
export * from './shared/talents'
export * from './shared/utils'

// Re-export version configs for testing
export { tbcConfig as anniversaryConfig } from './tbc'
export { eraConfig } from './era'
export { foreverConfig } from './forever'
export { sodConfig } from './sod'
