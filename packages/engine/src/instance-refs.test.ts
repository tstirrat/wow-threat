/**
 * Tests for instance-aware ID key helpers.
 */
import { describe, expect, it } from 'vitest'

import {
  buildActorKey,
  buildEnemyKey,
  normalizeInstanceId,
  parseActorKey,
  parseEnemyKey,
  toActorInstanceReference,
  toEnemyInstanceReference,
} from './instance-refs'

describe('normalizeInstanceId', () => {
  it('returns 0 when instanceId is undefined', () => {
    expect(normalizeInstanceId(undefined)).toBe(0)
  })

  it('returns the provided instanceId when defined', () => {
    expect(normalizeInstanceId(3)).toBe(3)
  })

  it('preserves 0 when explicitly passed', () => {
    expect(normalizeInstanceId(0)).toBe(0)
  })
})

describe('toActorInstanceReference', () => {
  it('normalizes missing instanceId to 0', () => {
    expect(toActorInstanceReference({ id: 5 })).toEqual({
      id: 5,
      instanceId: 0,
    })
  })

  it('preserves explicit instanceId', () => {
    expect(toActorInstanceReference({ id: 5, instanceId: 2 })).toEqual({
      id: 5,
      instanceId: 2,
    })
  })
})

describe('toEnemyInstanceReference', () => {
  it('normalizes missing instanceId to 0', () => {
    expect(toEnemyInstanceReference({ id: 10 })).toEqual({
      id: 10,
      instanceId: 0,
    })
  })

  it('preserves explicit instanceId', () => {
    expect(toEnemyInstanceReference({ id: 10, instanceId: 4 })).toEqual({
      id: 10,
      instanceId: 4,
    })
  })
})

describe('buildActorKey', () => {
  it('builds key with default instanceId 0 when omitted', () => {
    expect(buildActorKey({ id: 1 })).toBe('1:0')
  })

  it('builds key with explicit instanceId', () => {
    expect(buildActorKey({ id: 1, instanceId: 2 })).toBe('1:2')
  })
})

describe('buildEnemyKey', () => {
  it('builds key with default instanceId 0 when omitted', () => {
    expect(buildEnemyKey({ id: 42 })).toBe('42:0')
  })

  it('builds key with explicit instanceId', () => {
    expect(buildEnemyKey({ id: 42, instanceId: 3 })).toBe('42:3')
  })
})

describe('parseActorKey', () => {
  it('parses a key back to id and instanceId', () => {
    const key = buildActorKey({ id: 7, instanceId: 1 })
    expect(parseActorKey(key)).toEqual({ id: 7, instanceId: 1 })
  })

  it('parses a key with instanceId 0', () => {
    const key = buildActorKey({ id: 7 })
    expect(parseActorKey(key)).toEqual({ id: 7, instanceId: 0 })
  })
})

describe('parseEnemyKey', () => {
  it('parses a key back to id and instanceId', () => {
    const key = buildEnemyKey({ id: 99, instanceId: 5 })
    expect(parseEnemyKey(key)).toEqual({ id: 99, instanceId: 5 })
  })

  it('parses a key with instanceId 0', () => {
    const key = buildEnemyKey({ id: 99 })
    expect(parseEnemyKey(key)).toEqual({ id: 99, instanceId: 0 })
  })
})

describe('buildActorKey / parseActorKey round-trip', () => {
  it('recovers the original reference', () => {
    const ref = { id: 25, instanceId: 2 }
    expect(parseActorKey(buildActorKey(ref))).toEqual(ref)
  })

  it('recovers with default instanceId', () => {
    const ref = { id: 25 }
    expect(parseActorKey(buildActorKey(ref))).toEqual({ id: 25, instanceId: 0 })
  })
})

describe('buildEnemyKey / parseEnemyKey round-trip', () => {
  it('recovers the original reference', () => {
    const ref = { id: 100, instanceId: 7 }
    expect(parseEnemyKey(buildEnemyKey(ref))).toEqual(ref)
  })

  it('recovers with default instanceId', () => {
    const ref = { id: 100 }
    expect(parseEnemyKey(buildEnemyKey(ref))).toEqual({
      id: 100,
      instanceId: 0,
    })
  })
})
