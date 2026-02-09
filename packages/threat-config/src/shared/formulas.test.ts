/**
 * Tests for Built-in Threat Formulas
 */
import { describe, expect, it } from 'vitest'

import type { ThreatContext } from '../types'
import {
  castCanMiss,
  calculateThreat,
  modifyThreat,
  noThreat,
  tauntTarget,
  threatOnBuff,
  threatOnDebuff,
} from './formulas'

// Mock ThreatContext factory
function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: { type: 'damage' } as ThreatContext['event'],
    amount: 100,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestPlayer', class: 'warrior' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: {
      getPosition: () => null,
      getDistance: () => null,
      getActorsInRange: () => [],
      getThreat: () => 0,
      getTopActorsByThreat: () => [],
      isActorAlive: () => true,
      getCurrentTarget: () => null,
      getLastTarget: () => null,
    },
    ...overrides,
  }
}

describe('calculateThreat', () => {
  it('returns default threat (amt) with no options', () => {
    const formula = calculateThreat()
    const ctx = createMockContext({ amount: 500 })

    const result = formula(ctx)

    expect(result.formula).toBe('amt')
    expect(result.value).toBe(500)
    expect(result.splitAmongEnemies).toBe(false)
  })

  it('applies modifier to amount', () => {
    const formula = calculateThreat({ modifier: 2 })
    const ctx = createMockContext({ amount: 100 })

    const result = formula(ctx)

    expect(result.formula).toBe('amt * 2')
    expect(result.value).toBe(200)
  })

  it('applies modifier with decimal values', () => {
    const formula = calculateThreat({ modifier: 0.5 })
    const ctx = createMockContext({ amount: 100 })

    const result = formula(ctx)

    expect(result.formula).toBe('amt * 0.5')
    expect(result.value).toBe(50)
  })

  it('returns flat bonus threat with modifier: 0', () => {
    const formula = calculateThreat({ modifier: 0, bonus: 301 })
    const ctx = createMockContext({ amount: 100 })

    const result = formula(ctx)

    expect(result.formula).toBe('301')
    expect(result.value).toBe(301)
  })

  it('applies both modifier and bonus', () => {
    const formula = calculateThreat({ modifier: 2, bonus: 150 })
    const ctx = createMockContext({ amount: 100 })

    const result = formula(ctx)

    expect(result.formula).toBe('(amt * 2) + 150')
    expect(result.value).toBe(350) // (100 * 2) + 150
  })

  it('applies bonus without modifier', () => {
    const formula = calculateThreat({ modifier: 1, bonus: 145 })
    const ctx = createMockContext({ amount: 100 })

    const result = formula(ctx)

    expect(result.formula).toBe('amt + 145')
    expect(result.value).toBe(245)
  })

  it('supports split option', () => {
    const formula = calculateThreat({ modifier: 0, bonus: 70, split: true })
    const ctx = createMockContext()

    const result = formula(ctx)

    expect(result.formula).toBe('70')
    expect(result.value).toBe(70)
    expect(result.splitAmongEnemies).toBe(true)
  })

  it('handles negative bonus (threat reduction)', () => {
    const formula = calculateThreat({ modifier: 0, bonus: -240 })
    const ctx = createMockContext()

    const result = formula(ctx)

    expect(result.formula).toBe('-240')
    expect(result.value).toBe(-240)
  })

  it('handles zero threat', () => {
    const formula = calculateThreat({ modifier: 0, bonus: 0 })
    const ctx = createMockContext({ amount: 100 })

    const result = formula(ctx)

    expect(result.formula).toBe('0')
    expect(result.value).toBe(0)
  })

  it('handles complex formula with modifier and split', () => {
    const formula = calculateThreat({ modifier: 0.5, split: true })
    const ctx = createMockContext({ amount: 1000 })

    const result = formula(ctx)

    expect(result.formula).toBe('amt * 0.5')
    expect(result.value).toBe(500)
    expect(result.splitAmongEnemies).toBe(true)
  })

  it('handles modifier with bonus and split', () => {
    const formula = calculateThreat({ modifier: 1.75, bonus: 50, split: false })
    const ctx = createMockContext({ amount: 100 })

    const result = formula(ctx)

    expect(result.formula).toBe('(amt * 1.75) + 50')
    expect(result.value).toBe(225) // (100 * 1.75) + 50
    expect(result.splitAmongEnemies).toBe(false)
  })
})

describe('tauntTarget', () => {
  it('uses target instance when reading threat state', () => {
    const formula = tauntTarget({ bonus: 1 })
    let observedThreatInstance = -1
    let observedTopInstance = -1
    const ctx = createMockContext({
      event: {
        type: 'applydebuff',
        targetInstance: 3,
      } as ThreatContext['event'],
      amount: 0,
      actors: {
        getPosition: () => null,
        getDistance: () => null,
        getActorsInRange: () => [],
        getThreat: (_actorId, enemy) => {
          observedThreatInstance = enemy.instanceId ?? -1
          return 100
        },
        getTopActorsByThreat: (enemy) => {
          observedTopInstance = enemy.instanceId ?? -1
          return [{ actorId: 99, threat: 500 }]
        },
        isActorAlive: () => true,
      },
    })

    const result = formula(ctx)

    expect(observedThreatInstance).toBe(3)
    expect(observedTopInstance).toBe(3)
    expect(result.effects?.[0]).toEqual({
      type: 'customThreat',
      changes: [
        {
          sourceId: 1,
          targetId: 2,
          targetInstance: 3,
          operator: 'set',
          amount: 501,
          total: 501,
        },
      ],
    })
  })

  it('returns customThreat set to top threat + bonus', () => {
    const formula = tauntTarget({ bonus: 1 })
    const ctx = createMockContext({
      event: { type: 'applydebuff' } as ThreatContext['event'],
      amount: 0,
      actors: {
        getPosition: () => null,
        getDistance: () => null,
        getActorsInRange: () => [],
        getThreat: () => 100,
        getTopActorsByThreat: () => [{ actorId: 99, threat: 500 }],
        isActorAlive: () => true,
      },
    })

    const result = formula(ctx)

    expect(result.formula).toBe('topThreat + 1')
    expect(result.value).toBe(0)
    expect(result.effects?.[0]).toEqual({
      type: 'customThreat',
      changes: [
        {
          sourceId: 1,
          targetId: 2,
          targetInstance: 0,
          operator: 'set',
          amount: 501,
          total: 501,
        },
      ],
    })
    expect(result.splitAmongEnemies).toBe(false)
  })

  it('includes damage when modifier set', () => {
    const formula = tauntTarget({ modifier: 1, bonus: 0 })
    const ctx = createMockContext({
      event: { type: 'applydebuff' } as ThreatContext['event'],
      amount: 500,
      actors: {
        getPosition: () => null,
        getDistance: () => null,
        getActorsInRange: () => [],
        getThreat: () => 100,
        getTopActorsByThreat: () => [{ actorId: 99, threat: 400 }],
        isActorAlive: () => true,
      },
    })

    const result = formula(ctx)

    expect(result.formula).toBe('topThreat + amt')
    expect(result.value).toBe(0)
    expect(result.effects?.[0]).toEqual({
      type: 'customThreat',
      changes: [
        {
          sourceId: 1,
          targetId: 2,
          targetInstance: 0,
          operator: 'set',
          amount: 900,
          total: 900,
        },
      ],
    })
  })

  it('does not lower threat when already above taunt threshold', () => {
    const formula = tauntTarget({ modifier: 1, bonus: 100 })
    const ctx = createMockContext({
      event: { type: 'applydebuff' } as ThreatContext['event'],
      amount: 300,
      actors: {
        getPosition: () => null,
        getDistance: () => null,
        getActorsInRange: () => [],
        getThreat: () => 1000,
        getTopActorsByThreat: () => [{ actorId: 99, threat: 500 }],
        isActorAlive: () => true,
      },
    })

    const result = formula(ctx)

    expect(result.formula).toBe('topThreat + amt + 100')
    expect(result.effects?.[0]).toEqual({
      type: 'customThreat',
      changes: [
        {
          sourceId: 1,
          targetId: 2,
          targetInstance: 0,
          operator: 'set',
          amount: 1000,
          total: 1000,
        },
      ],
    })
  })
})

describe('modifyThreat', () => {
  it('returns modifyThreat special with multiplier', () => {
    const formula = modifyThreat({ modifier: 0.5 })
    const ctx = createMockContext()

    const result = formula(ctx)

    expect(result.formula).toBe('threat * 0.5')
    expect(result.value).toBe(0)
    expect(result.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0.5,
      target: 'target',
    })
    expect(result.splitAmongEnemies).toBe(false)
  })

  it('handles threat wipe (multiplier 0)', () => {
    const formula = modifyThreat({ modifier: 0 })
    const ctx = createMockContext()

    const result = formula(ctx)

    expect(result.formula).toBe('threatWipe')
    expect(result.value).toBe(0)
    expect(result.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0,
      target: 'target',
    })
  })

  it('handles threat doubling', () => {
    const formula = modifyThreat({ modifier: 2 })
    const ctx = createMockContext()

    const result = formula(ctx)

    expect(result.formula).toBe('threat * 2')
    expect(result.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 2,
      target: 'target',
    })
  })

  it('supports target=all option for boss-wide wipes', () => {
    const formula = modifyThreat({ modifier: 0, target: 'all' })
    const ctx = createMockContext()

    const result = formula(ctx)

    expect(result.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0,
      target: 'all',
    })
  })
})

describe('threatOnDebuff', () => {
  it('applies threat on applydebuff', () => {
    const formula = threatOnDebuff(120)
    const ctx = createMockContext({
      event: { type: 'applydebuff' } as ThreatContext['event'],
    })

    const result = formula(ctx)

    expect(result.formula).toBe('120')
    expect(result.value).toBe(120)
  })

  it('applies threat on refresh and stack debuff phases', () => {
    const formula = threatOnDebuff(120)

    const refreshResult = formula(
      createMockContext({
        event: { type: 'refreshdebuff' } as ThreatContext['event'],
      }),
    )
    const stackResult = formula(
      createMockContext({
        event: { type: 'applydebuffstack' } as ThreatContext['event'],
      }),
    )

    expect(refreshResult.value).toBe(120)
    expect(stackResult.value).toBe(120)
  })

  it('returns undefined for non-debuff phases', () => {
    const formula = threatOnDebuff(120)
    const ctx = createMockContext({
      event: { type: 'cast' } as ThreatContext['event'],
    })

    const result = formula(ctx)

    expect(result).toBeUndefined()
  })
})

describe('threatOnBuff', () => {
  it('applies threat on applybuff', () => {
    const formula = threatOnBuff(70, { split: true })
    const ctx = createMockContext({
      event: { type: 'applybuff' } as ThreatContext['event'],
    })

    const result = formula(ctx)

    expect(result.formula).toBe('70')
    expect(result.value).toBe(70)
    expect(result.splitAmongEnemies).toBe(true)
  })

  it('applies threat on refresh and stack buff phases', () => {
    const formula = threatOnBuff(70)

    const refreshResult = formula(
      createMockContext({
        event: { type: 'refreshbuff' } as ThreatContext['event'],
      }),
    )
    const stackResult = formula(
      createMockContext({
        event: { type: 'applybuffstack' } as ThreatContext['event'],
      }),
    )

    expect(refreshResult.value).toBe(70)
    expect(stackResult.value).toBe(70)
  })

  it('returns undefined for non-buff phases', () => {
    const formula = threatOnBuff(70)
    const ctx = createMockContext({
      event: { type: 'damage' } as ThreatContext['event'],
    })

    const result = formula(ctx)

    expect(result).toBeUndefined()
  })
})

describe('castCanMiss', () => {
  it('applies flat threat on cast events', () => {
    const formula = castCanMiss(301)
    const ctx = createMockContext({
      event: { type: 'cast' } as ThreatContext['event'],
    })

    const result = formula(ctx)

    expect(result.formula).toBe('301 (cast)')
    expect(result.value).toBe(301)
  })

  it('returns negative threat on miss damage events', () => {
    const formula = castCanMiss(301)
    const ctx = createMockContext({
      event: { type: 'damage', hitType: 'miss' } as ThreatContext['event'],
    })

    const result = formula(ctx)

    expect(result.formula).toBe('-301 (miss rollback)')
    expect(result.value).toBe(-301)
  })

  it('returns undefined for non-miss damage events', () => {
    const formula = castCanMiss(301)
    const ctx = createMockContext({
      event: { type: 'damage', hitType: 'hit' } as ThreatContext['event'],
    })

    const result = formula(ctx)

    expect(result).toBeUndefined()
  })

  it('returns undefined for non-cast/non-damage phases', () => {
    const formula = castCanMiss(301)
    const ctx = createMockContext({
      event: { type: 'applydebuff' } as ThreatContext['event'],
    })

    const result = formula(ctx)

    expect(result).toBeUndefined()
  })
})

describe('noThreat', () => {
  it('returns zero threat', () => {
    const formula = noThreat()
    const ctx = createMockContext()

    const result = formula(ctx)

    expect(result.formula).toBe('0')
    expect(result.value).toBe(0)
    expect(result.effects?.[0]).toBeUndefined()
  })
})
