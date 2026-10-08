/**
 * Tests for shared threat-config cache version wiring.
 */
import { describe, expect, it } from 'vitest'

import { eraConfig } from './era'
import { foreverConfig } from './forever'
import { sodConfig } from './sod'
import { tbcConfig } from './tbc'
import { configCacheVersion, configVersionVector } from './version'

describe('configCacheVersion', () => {
  it('concatenates top-level config versions in a stable order', () => {
    expect(configVersionVector).toEqual({
      era: eraConfig.version,
      sod: sodConfig.version,
      anniversary: tbcConfig.version,
      forever: foreverConfig.version,
    })
    expect(configCacheVersion).toBe(
      `${eraConfig.version}${sodConfig.version}${tbcConfig.version}${foreverConfig.version}`,
    )
  })

  it('uses numeric versions for each top-level config', () => {
    expect(typeof eraConfig.version).toBe('number')
    expect(typeof sodConfig.version).toBe('number')
    expect(typeof tbcConfig.version).toBe('number')
    expect(typeof foreverConfig.version).toBe('number')
  })
})
