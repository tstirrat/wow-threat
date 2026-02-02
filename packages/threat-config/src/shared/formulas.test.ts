/**
 * Tests for Built-in Threat Formulas
 */

import { describe, it, expect } from 'vitest'
import type { ThreatContext } from '../types'
import {
  defaultFormula,
  flat,
  modAmount,
  modAmountFlat,
  tauntTarget,
  threatDrop,
  noThreat,
} from './formulas'

// Mock ThreatContext factory
function createMockContext(overrides: Partial<ThreatContext> = {}): ThreatContext {
  return {
    event: { type: 'damage' } as ThreatContext['event'],
    amount: 100,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    enemies: [],
    sourceActor: { id: 1, name: 'TestPlayer', class: 'warrior' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    ...overrides,
  }
}

describe('defaultFormula', () => {
  it('returns threat equal to amount', () => {
    const formula = defaultFormula()
    const ctx = createMockContext({ amount: 500 })

    const result = formula(ctx)

    expect(result.formula).toBe('amt')
    expect(result.baseThreat).toBe(500)
    expect(result.splitAmongEnemies).toBe(false)
    expect(result.modifiers).toEqual([])
  })

  it('supports split option', () => {
    const formula = defaultFormula({ split: true })
    const ctx = createMockContext({ amount: 1000 })

    const result = formula(ctx)

    expect(result.baseThreat).toBe(1000)
    expect(result.splitAmongEnemies).toBe(true)
  })
})

describe('flat', () => {
  it('returns flat threat value ignoring amount', () => {
    const formula = flat(301)
    const ctx = createMockContext({ amount: 1000 })

    const result = formula(ctx)

    expect(result.formula).toBe('301')
    expect(result.baseThreat).toBe(301)
    expect(result.splitAmongEnemies).toBe(false)
  })

  it('supports split option', () => {
    const formula = flat(70, { split: true })
    const ctx = createMockContext({ amount: 0 })

    const result = formula(ctx)

    expect(result.baseThreat).toBe(70)
    expect(result.splitAmongEnemies).toBe(true)
  })

  it('works with zero value', () => {
    const formula = flat(0)
    const ctx = createMockContext()

    const result = formula(ctx)

    expect(result.formula).toBe('0')
    expect(result.baseThreat).toBe(0)
  })
})

describe('modAmount', () => {
  it('multiplies amount by modifier', () => {
    const formula = modAmount(0.5)
    const ctx = createMockContext({ amount: 1000 })

    const result = formula(ctx)

    expect(result.formula).toBe('amt * 0.5')
    expect(result.baseThreat).toBe(500)
  })

  it('simplifies formula when mod is 1', () => {
    const formula = modAmount(1)
    const ctx = createMockContext({ amount: 200 })

    const result = formula(ctx)

    expect(result.formula).toBe('amt')
    expect(result.baseThreat).toBe(200)
  })

  it('handles mod of 2', () => {
    const formula = modAmount(2)
    const ctx = createMockContext({ amount: 300 })

    const result = formula(ctx)

    expect(result.formula).toBe('amt * 2')
    expect(result.baseThreat).toBe(600)
  })
})

describe('modAmountFlat', () => {
  it('calculates (amt * mod) + flat', () => {
    const formula = modAmountFlat(2, 150)
    const ctx = createMockContext({ amount: 500 })

    const result = formula(ctx)

    expect(result.formula).toBe('(amt * 2) + 150')
    expect(result.baseThreat).toBe(1150) // (500 * 2) + 150
  })

  it('simplifies formula when mod is 1', () => {
    const formula = modAmountFlat(1, 355)
    const ctx = createMockContext({ amount: 200 })

    const result = formula(ctx)

    expect(result.formula).toBe('amt + 355')
    expect(result.baseThreat).toBe(555)
  })

  it('simplifies formula when mod is 0', () => {
    const formula = modAmountFlat(0, 100)
    const ctx = createMockContext({ amount: 500 })

    const result = formula(ctx)

    expect(result.formula).toBe('100')
    expect(result.baseThreat).toBe(100)
  })

  it('supports split option', () => {
    const formula = modAmountFlat(1, 100, { split: true })
    const ctx = createMockContext({ amount: 200 })

    const result = formula(ctx)

    expect(result.splitAmongEnemies).toBe(true)
  })
})

describe('tauntTarget', () => {
  it('returns taunt special with fixate duration', () => {
    const formula = tauntTarget(1, 3000)
    const ctx = createMockContext({ amount: 0 })

    const result = formula(ctx)

    expect(result.formula).toBe('topThreat + 1')
    expect(result.baseThreat).toBe(1)
    expect(result.special).toEqual({ type: 'taunt', fixateDuration: 3000 })
    expect(result.splitAmongEnemies).toBe(false)
  })

  it('includes damage when addDamage option set', () => {
    const formula = tauntTarget(0, 6000, { addDamage: true })
    const ctx = createMockContext({ amount: 500 })

    const result = formula(ctx)

    expect(result.formula).toBe('topThreat + amt + 0')
    expect(result.baseThreat).toBe(500) // Just the damage, bonus is 0
    expect(result.special).toEqual({ type: 'taunt', fixateDuration: 6000 })
  })

  it('adds damage + bonus threat together', () => {
    const formula = tauntTarget(100, 4000, { addDamage: true })
    const ctx = createMockContext({ amount: 300 })

    const result = formula(ctx)

    expect(result.formula).toBe('topThreat + amt + 100')
    expect(result.baseThreat).toBe(400) // 300 damage + 100 bonus
  })
})

describe('threatDrop', () => {
  it('returns threat drop special', () => {
    const formula = threatDrop()
    const ctx = createMockContext()

    const result = formula(ctx)

    expect(result.formula).toBe('threatDrop')
    expect(result.baseThreat).toBe(0)
    expect(result.special).toEqual({ type: 'threatDrop' })
    expect(result.splitAmongEnemies).toBe(false)
  })
})

describe('noThreat', () => {
  it('returns zero threat without duration', () => {
    const formula = noThreat()
    const ctx = createMockContext()

    const result = formula(ctx)

    expect(result.formula).toBe('0')
    expect(result.baseThreat).toBe(0)
    expect(result.special).toBeUndefined()
  })

  it('returns no threat window with duration', () => {
    const formula = noThreat(30000)
    const ctx = createMockContext()

    const result = formula(ctx)

    expect(result.formula).toBe('0')
    expect(result.baseThreat).toBe(0)
    expect(result.special).toEqual({ type: 'noThreatWindow', duration: 30000 })
  })
})
