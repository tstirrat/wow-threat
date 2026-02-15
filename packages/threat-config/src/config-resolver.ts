/**
 * Threat Config Resolver
 *
 * Resolves the correct threat config by evaluating each config's own resolver.
 */
import type { ThreatConfig } from '@wcl-threat/shared'
import type { ThreatConfigResolutionInput } from '@wcl-threat/shared'

import { eraConfig } from './era'
import { sodConfig } from './sod'
import { anniversaryConfig } from './tbc'

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
  const matches = configs.filter((config) => config.resolve(input))
  // Fail closed if no config matches or if metadata ambiguously matches more than one.
  if (matches.length !== 1) {
    return null
  }

  return matches[0] ?? null
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
      `No threat config for gameVersion ${input.gameVersion} with provided report metadata`,
    )
  }
  return config
}
