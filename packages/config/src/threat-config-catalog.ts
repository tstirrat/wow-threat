/**
 * Named threat configs that can be selected directly, including from a URL.
 */
import type { ThreatConfig } from '@wow-threat/shared'

import { eraConfig } from './era'
import { sodConfig } from './sod'
import { tbcConfig } from './tbc'

export const threatConfigIds = ['era', 'sod', 'anniversary'] as const

export type ThreatConfigId = (typeof threatConfigIds)[number]

const threatConfigIdAliases = {
  era: 'era',
  sod: 'sod',
  anniversary: 'anniversary',
  tbc: 'anniversary',
} as const satisfies Record<string, ThreatConfigId>

const threatConfigsById = {
  era: eraConfig,
  sod: sodConfig,
  anniversary: tbcConfig,
} as const satisfies Record<ThreatConfigId, ThreatConfig>

/** Parse a config id from a query param. `tbc` is an alias for `anniversary`. */
export function parseThreatConfigId(
  value: string | null | undefined,
): ThreatConfigId | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized || !(normalized in threatConfigIdAliases)) {
    return null
  }

  return threatConfigIdAliases[normalized as keyof typeof threatConfigIdAliases]
}

/** Return the threat config registered under a known id. */
export function getThreatConfigById(id: ThreatConfigId): ThreatConfig {
  return threatConfigsById[id]
}
