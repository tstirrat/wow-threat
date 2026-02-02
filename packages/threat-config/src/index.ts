/**
 * Threat Configuration Package
 *
 * Exports the getConfig function and all types/utilities for threat calculations.
 */

import type { ThreatConfig } from './types'
import { anniversaryConfig } from './anniversary'
import { sodConfig } from './sod'
import { retailConfig } from './retail'

// Map WCL gameVersion integers to configs
const configs: Record<number, ThreatConfig> = {
  1: anniversaryConfig, // Anniversary Edition / Classic Era
  2: sodConfig, // Season of Discovery
  3: retailConfig, // Retail
}

/**
 * Get the threat config for a specific game version
 */
export function getConfig(gameVersion: number): ThreatConfig {
  const config = configs[gameVersion]
  if (!config) {
    throw new Error(`No threat config for gameVersion: ${gameVersion}`)
  }
  return config
}

/**
 * Get the config version string for a specific game version
 */
export function getConfigVersion(gameVersion: number): string {
  return getConfig(gameVersion).version
}

/**
 * Get all supported game versions
 */
export function getSupportedGameVersions(): number[] {
  return Object.keys(configs).map(Number)
}

// Re-export types
export * from './types'
export * from './shared/formulas'
export * from './shared/utils'

// Re-export version configs for testing
export { anniversaryConfig } from './anniversary'
export { sodConfig } from './sod'
export { retailConfig } from './retail'
