/**
 * Tests for Built-in Threat Formulas
 */
import {
  createApplyBuffEvent,
  createApplyBuffStackEvent,
  createApplyDebuffEvent,
  createApplyDebuffStackEvent,
  createCastEvent,
  createDamageEvent,
  createMockActorContext,
  createRefreshBuffEvent,
  createRefreshDebuffEvent,
} from '@wcl-threat/shared'
import type { ThreatContext } from '@wcl-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import {
  calculateThreat,
  calculateThreatOnSuccessfulHit,
  modifyThreat,
  modifyThreatOnHit,
  noThreat,
  tauntTarget,
  threatOnBuff,
  threatOnCastRollbackOnMiss,
  threatOnDebuff,
  threatOnDebuffOrDamage,
} from './formulas'

// Mock ThreatContext factory
function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: createDamageEvent(),
    amount: 100,
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestPlayer', class: 'warrior' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...overrides,
  }
}

function assertDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined()
  if (value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

describe('calculateThreat', () => {
  it('returns default threat (amt) with no options', () => {
    const formula = calculateThreat()
    const ctx = createMockContext({ amount: 500 })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('amt')
    expect(result.value).toBe(500)
    expect(result.splitAmongEnemies).toBe(false)
  })

  it('applies modifier to amount', () => {
    const formula = calculateThreat({ modifier: 2 })
    const ctx = createMockContext({ amount: 100 })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('amt * 2')
    expect(result.value).toBe(200)
  })

  it('applies modifier with decimal values', () => {
    const formula = calculateThreat({ modifier: 0.5 })
    const ctx = createMockContext({ amount: 100 })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('amt * 0.5')
    expect(result.value).toBe(50)
  })

  it('returns flat bonus threat with modifier: 0', () => {
    const formula = calculateThreat({ modifier: 0, bonus: 301 })
    const ctx = createMockContext({ amount: 100 })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('301')
    expect(result.value).toBe(301)
  })

  it('applies both modifier and bonus', () => {
    const formula = calculateThreat({ modifier: 2, bonus: 150 })
    const ctx = createMockContext({ amount: 100 })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('(amt * 2) + 150')
    expect(result.value).toBe(350) // (100 * 2) + 150
  })

  it('applies bonus without modifier', () => {
    const formula = calculateThreat({ modifier: 1, bonus: 145 })
    const ctx = createMockContext({ amount: 100 })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('amt + 145')
    expect(result.value).toBe(245)
  })

  it('supports split option', () => {
    const formula = calculateThreat({ modifier: 0, bonus: 70, split: true })
    const ctx = createMockContext()

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('70')
    expect(result.value).toBe(70)
    expect(result.splitAmongEnemies).toBe(true)
  })

  it('handles negative bonus (threat reduction)', () => {
    const formula = calculateThreat({ modifier: 0, bonus: -240 })
    const ctx = createMockContext()

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('-240')
    expect(result.value).toBe(-240)
  })

  it('handles zero threat', () => {
    const formula = calculateThreat({ modifier: 0, bonus: 0 })
    const ctx = createMockContext({ amount: 100 })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('0')
    expect(result.value).toBe(0)
  })

  it('handles complex formula with modifier and split', () => {
    const formula = calculateThreat({ modifier: 0.5, split: true })
    const ctx = createMockContext({ amount: 1000 })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('amt * 0.5')
    expect(result.value).toBe(500)
    expect(result.splitAmongEnemies).toBe(true)
  })

  it('handles modifier with bonus and split', () => {
    const formula = calculateThreat({ modifier: 1.75, bonus: 50, split: false })
    const ctx = createMockContext({ amount: 100 })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('(amt * 1.75) + 50')
    expect(result.value).toBe(225) // (100 * 1.75) + 50
    expect(result.splitAmongEnemies).toBe(false)
  })

  it('allows formulas to disable player multipliers', () => {
    const formula = calculateThreat({
      modifier: 0,
      bonus: 100,
      applyPlayerMultipliers: false,
    })
    const result = assertDefined(formula(createMockContext()))

    expect(result.applyPlayerMultipliers).toBe(false)
  })
})

describe('calculateThreatOnSuccessfulHit', () => {
  it('applies threat on successful damage hits', () => {
    const formula = calculateThreatOnSuccessfulHit({ bonus: 175 })
    const result = assertDefined(
      formula(
        createMockContext({
          event: createDamageEvent({ hitType: 'hit' }),
          amount: 1000,
        }),
      ),
    )

    expect(result.formula).toBe('amt + 175')
    expect(result.value).toBe(1175)
  })

  it('returns undefined on misses', () => {
    const formula = calculateThreatOnSuccessfulHit({ bonus: 175 })
    const result = formula(
      createMockContext({
        event: createDamageEvent({ hitType: 'miss' }),
        amount: 0,
      }),
    )

    expect(result).toBeUndefined()
  })

  it('returns undefined for non-damage event types', () => {
    const formula = calculateThreatOnSuccessfulHit({ bonus: 175 })
    const result = formula(
      createMockContext({
        event: createCastEvent(),
        amount: 0,
      }),
    )

    expect(result).toBeUndefined()
  })
})

describe('tauntTarget', () => {
  it('uses target instance when reading threat state', () => {
    const formula = tauntTarget({ bonus: 1 })
    let observedThreatInstance = -1
    let observedTopInstance = -1
    const ctx = createMockContext({
      event: createApplyDebuffEvent({ targetInstance: 3 }),
      amount: 0,
      actors: createMockActorContext({
        getThreat: (_actorId, enemy) => {
          observedThreatInstance = enemy.instanceId ?? -1
          return 100
        },
        getTopActorsByThreat: (enemy) => {
          observedTopInstance = enemy.instanceId ?? -1
          return [{ actorId: 99, threat: 500 }]
        },
        isActorAlive: () => true,
      }),
    })

    const result = assertDefined(formula(ctx))

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
      event: createApplyDebuffEvent(),
      amount: 0,
      actors: createMockActorContext({
        getThreat: () => 100,
        getTopActorsByThreat: () => [{ actorId: 99, threat: 500 }],
        isActorAlive: () => true,
      }),
    })

    const result = assertDefined(formula(ctx))

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
      event: createApplyDebuffEvent(),
      amount: 500,
      actors: createMockActorContext({
        getThreat: () => 100,
        getTopActorsByThreat: () => [{ actorId: 99, threat: 400 }],
        isActorAlive: () => true,
      }),
    })

    const result = assertDefined(formula(ctx))

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
      event: createApplyDebuffEvent(),
      amount: 300,
      actors: createMockActorContext({
        getThreat: () => 1000,
        getTopActorsByThreat: () => [{ actorId: 99, threat: 500 }],
        isActorAlive: () => true,
      }),
    })

    const result = assertDefined(formula(ctx))

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

    const result = assertDefined(formula(ctx))

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

    const result = assertDefined(formula(ctx))

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

    const result = assertDefined(formula(ctx))

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

    const result = assertDefined(formula(ctx))

    expect(result.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0,
      target: 'all',
    })
  })

  it('supports event type filtering', () => {
    const formula = modifyThreat({
      modifier: 0,
      target: 'all',
      eventTypes: ['cast'],
    })
    const damageCtx = createMockContext({
      event: createDamageEvent(),
    })
    const castCtx = createMockContext({
      event: createCastEvent(),
    })

    expect(formula(damageCtx)).toBeUndefined()
    expect(assertDefined(formula(castCtx)).effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0,
      target: 'all',
    })
  })
})

describe('modifyThreatOnHit', () => {
  it('applies threat modification on matching damage hit types', () => {
    const formula = modifyThreatOnHit(0.5)
    const ctx = createMockContext({
      event: createDamageEvent({ hitType: 'hit' }),
    })

    const result = assertDefined(formula(ctx))
    expect(result.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0.5,
      target: 'target',
    })
  })

  it('ignores non-matching hit types', () => {
    const formula = modifyThreatOnHit(0.5)
    const ctx = createMockContext({
      event: createDamageEvent({ hitType: 'dodge' }),
    })

    expect(formula(ctx)).toBeUndefined()
  })
})

describe('threatOnDebuffOrDamage', () => {
  it('returns flat threat on debuff apply', () => {
    const formula = threatOnDebuffOrDamage(120)
    const ctx = createMockContext({
      event: createApplyDebuffEvent(),
    })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('120')
    expect(result.value).toBe(120)
    expect(result.splitAmongEnemies).toBe(false)
  })

  it('returns normal damage threat on damage events', () => {
    const formula = threatOnDebuffOrDamage(120)
    const ctx = createMockContext({
      event: createDamageEvent(),
      amount: 345,
    })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('amt')
    expect(result.value).toBe(345)
    expect(result.splitAmongEnemies).toBe(false)
  })

  it('returns undefined for unrelated events', () => {
    const formula = threatOnDebuffOrDamage(120)
    const ctx = createMockContext({
      event: createCastEvent(),
    })

    const result = formula(ctx)

    expect(result).toBeUndefined()
  })
})

describe('threatOnDebuff', () => {
  it('applies threat on applydebuff', () => {
    const formula = threatOnDebuff(120)
    const ctx = createMockContext({
      event: createApplyDebuffEvent(),
    })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('120')
    expect(result.value).toBe(120)
  })

  it('applies threat on refresh and stack debuff phases', () => {
    const formula = threatOnDebuff(120)

    const refreshResult = assertDefined(
      formula(
        createMockContext({
          event: createRefreshDebuffEvent(),
        }),
      ),
    )
    const stackResult = assertDefined(
      formula(
        createMockContext({
          event: createApplyDebuffStackEvent(),
        }),
      ),
    )

    expect(refreshResult.value).toBe(120)
    expect(stackResult.value).toBe(120)
  })

  it('returns undefined for non-debuff phases', () => {
    const formula = threatOnDebuff(120)
    const ctx = createMockContext({
      event: createCastEvent(),
    })

    const result = formula(ctx)

    expect(result).toBeUndefined()
  })
})

describe('threatOnBuff', () => {
  it('applies threat on applybuff', () => {
    const formula = threatOnBuff(70, { split: true })
    const ctx = createMockContext({
      event: createApplyBuffEvent(),
    })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('70')
    expect(result.value).toBe(70)
    expect(result.splitAmongEnemies).toBe(true)
  })

  it('applies threat on refresh and stack buff phases', () => {
    const formula = threatOnBuff(70)

    const refreshResult = assertDefined(
      formula(
        createMockContext({
          event: createRefreshBuffEvent(),
        }),
      ),
    )
    const stackResult = assertDefined(
      formula(
        createMockContext({
          event: createApplyBuffStackEvent(),
        }),
      ),
    )

    expect(refreshResult.value).toBe(70)
    expect(stackResult.value).toBe(70)
  })

  it('returns undefined for non-buff phases', () => {
    const formula = threatOnBuff(70)
    const ctx = createMockContext({
      event: createDamageEvent(),
    })

    const result = formula(ctx)

    expect(result).toBeUndefined()
  })
})

describe('threatOnCastRollbackOnMiss', () => {
  it('applies flat threat on cast events', () => {
    const formula = threatOnCastRollbackOnMiss(301)
    const ctx = createMockContext({
      event: createCastEvent(),
    })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('301 (cast)')
    expect(result.value).toBe(301)
  })

  it('returns negative threat on miss damage events', () => {
    const formula = threatOnCastRollbackOnMiss(301)
    const ctx = createMockContext({
      event: createDamageEvent({ hitType: 'miss' }),
    })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('-301 (miss rollback)')
    expect(result.value).toBe(-301)
  })

  it('returns negative threat on immune damage events', () => {
    const formula = threatOnCastRollbackOnMiss(301)
    const ctx = createMockContext({
      event: createDamageEvent({ hitType: 'immune' }),
    })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('-301 (miss rollback)')
    expect(result.value).toBe(-301)
  })

  it('returns negative threat on resist damage events', () => {
    const formula = threatOnCastRollbackOnMiss(301)
    const ctx = createMockContext({
      event: createDamageEvent({ hitType: 'resist' }),
    })

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('-301 (miss rollback)')
    expect(result.value).toBe(-301)
  })

  it('returns undefined for non-miss damage events', () => {
    const formula = threatOnCastRollbackOnMiss(301)
    const ctx = createMockContext({
      event: createDamageEvent({ hitType: 'hit' }),
    })

    const result = formula(ctx)

    expect(result).toBeUndefined()
  })

  it('returns undefined for non-cast/non-damage phases', () => {
    const formula = threatOnCastRollbackOnMiss(301)
    const ctx = createMockContext({
      event: createApplyDebuffEvent(),
    })

    const result = formula(ctx)

    expect(result).toBeUndefined()
  })

  it('supports disabling player multipliers for both phases', () => {
    const formula = threatOnCastRollbackOnMiss(301, {
      applyPlayerMultipliers: false,
    })
    const castResult = assertDefined(
      formula(
        createMockContext({
          event: createCastEvent(),
        }),
      ),
    )
    const rollbackResult = assertDefined(
      formula(
        createMockContext({
          event: createDamageEvent({ hitType: 'miss' }),
        }),
      ),
    )

    expect(castResult.applyPlayerMultipliers).toBe(false)
    expect(rollbackResult.applyPlayerMultipliers).toBe(false)
  })
})

describe('noThreat', () => {
  it('returns zero threat', () => {
    const formula = noThreat()
    const ctx = createMockContext()

    const result = assertDefined(formula(ctx))

    expect(result.formula).toBe('0')
    expect(result.value).toBe(0)
    expect(result.effects?.[0]).toBeUndefined()
  })
})
