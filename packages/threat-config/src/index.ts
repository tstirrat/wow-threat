/**
 * Threat Configuration Package
 *
 * Exports config resolvers and shared threat calculation utilities.
 */
/**
 * Get all supported game versions
 */
export function getSupportedGameVersions(): number[] {
  // Resolver supports WCL gameVersion 2 (Era/Anniversary/SoD via metadata).
  return [2]
}

export { resolveConfig, resolveConfigOrNull } from './config-resolver'

// Re-export types
export * from './shared/formulas'
export * from './shared/talents'
export * from './shared/utils'

// Re-export version configs for testing
export { anniversaryConfig } from './tbc'
export { eraConfig } from './era'
export { sodConfig } from './sod'
