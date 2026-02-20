/**
 * Threat Config Resolver
 *
 * Resolves the correct threat config by evaluating each config's own resolver.
 */
import type { ThreatConfig } from '@wow-threat/shared'
import type { ThreatConfigResolutionInput } from '@wow-threat/shared'

import { eraConfig } from './era'
import { sodConfig } from './sod'
import { anniversaryConfig } from './tbc'

// Resolver precedence matters for overlapping metadata buckets.
const configs: ThreatConfig[] = [sodConfig, anniversaryConfig, eraConfig]

/**
 * Resolve the best threat config for report metadata.
 *
 * Returns null for unsupported branches so API routes can fail closed instead of
 * silently applying incorrect generic threat math.
 */
export function resolveConfigOrNull(
  input: ThreatConfigResolutionInput,
): ThreatConfig | null {
  for (const config of configs) {
    if (config.resolve(input)) {
      return config
    }
  }

  return null
}

/**
 * Resolve threat config for report metadata.
 */
export function resolveConfig(
  input: ThreatConfigResolutionInput,
): ThreatConfig {
  const config = resolveConfigOrNull(input)
  if (!config) {
    throw new Error(
      `No threat config for gameVersion ${input.report.masterData.gameVersion} with provided report metadata`,
    )
  }
  return config
}
