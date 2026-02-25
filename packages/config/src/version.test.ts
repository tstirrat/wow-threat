/**
 * Tests for shared threat-config cache version wiring.
 */
import { describe, expect, it } from 'vitest'

import { eraConfig } from './era'
import { sodConfig } from './sod'
import { anniversaryConfig } from './tbc'
import { configCacheVersion, configVersionVector } from './version'

describe('configCacheVersion', () => {
  it('concatenates top-level config versions in a stable order', () => {
    expect(configVersionVector).toEqual({
      era: eraConfig.version,
      sod: sodConfig.version,
      anniversary: anniversaryConfig.version,
    })
    expect(configCacheVersion).toBe(
      `${eraConfig.version}${sodConfig.version}${anniversaryConfig.version}`,
    )
  })

  it('uses numeric versions for each top-level config', () => {
    expect(typeof eraConfig.version).toBe('number')
    expect(typeof sodConfig.version).toBe('number')
    expect(typeof anniversaryConfig.version).toBe('number')
  })
})
