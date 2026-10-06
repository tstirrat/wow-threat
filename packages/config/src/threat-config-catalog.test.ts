/**
 * Tests for direct threat-config selection by id.
 */
import { describe, expect, it } from 'vitest'

import { eraConfig } from './era'
import { sodConfig } from './sod'
import { tbcConfig } from './tbc'
import {
  getThreatConfigById,
  parseThreatConfigId,
  threatConfigIds,
} from './threat-config-catalog'

describe('threat config catalog', () => {
  it('parses known config ids and the tbc alias', () => {
    expect(parseThreatConfigId(' Era ')).toBe('era')
    expect(parseThreatConfigId('tbc')).toBe('anniversary')
    expect(parseThreatConfigId('anniversary')).toBe('anniversary')
    expect(parseThreatConfigId('era')).toBe('era')
    expect(parseThreatConfigId('sod')).toBe('sod')
  })

  it('rejects missing and unknown config ids', () => {
    expect(parseThreatConfigId(null)).toBeNull()
    expect(parseThreatConfigId('')).toBeNull()
    expect(parseThreatConfigId('   ')).toBeNull()
    expect(parseThreatConfigId('retail')).toBeNull()
    expect(parseThreatConfigId('forever')).toBeNull()
  })

  it('returns the registered config for each id', () => {
    expect(threatConfigIds).toEqual(['era', 'sod', 'anniversary'])
    expect(getThreatConfigById('era')).toBe(eraConfig)
    expect(getThreatConfigById('sod')).toBe(sodConfig)
    expect(getThreatConfigById('anniversary')).toBe(tbcConfig)
  })
})
