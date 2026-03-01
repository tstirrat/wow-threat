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
} from '@wow-threat/shared'
import type { ThreatContext } from '@wow-threat/shared/src/types'
import { HitTypeCode } from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import {
  modifyThreat,
  modifyThreatOnHit,
  noThreat,
  tauntTarget,
  threat,
  threatOnBuff,
  threatOnBuffOrDamage,
  threatOnCastRollbackOnMiss,
  threatOnDebuff,
  threatOnDebuffOrDamage,
  threatOnSuccessfulHit,
} from './formulas'

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

describe('formulas', () => {
  describe('threat()', () => {
    it('returns default threat with no spell modifier', () => {
      const result = assertDefined(threat()(createMockContext({ amount: 500 })))

      expect(result.value).toBe(500)
      expect(result.spellModifier).toBeUndefined()
      expect(result.splitAmongEnemies).toBe(false)
    })

    it('returns structured spell modifier for multiplier + bonus', () => {
      const result = assertDefined(
        threat({ modifier: 2, bonus: 150 })(createMockContext({ amount: 100 })),
      )

      expect(result.value).toBe(350)
      expect(result.spellModifier).toEqual({
        type: 'spell',
        value: 2,
        bonus: 150,
      })
    })

    it('returns structured spell modifier for flat threat', () => {
      const result = assertDefined(
        threat({ modifier: 0, bonus: 301 })(createMockContext({ amount: 100 })),
      )

      expect(result.value).toBe(301)
      expect(result.spellModifier).toEqual({
        type: 'spell',
        value: 0,
        bonus: 301,
      })
    })

    it('handles zero threat and split settings', () => {
      const result = assertDefined(
        threat({ modifier: 0, bonus: 0, split: true })(
          createMockContext({ amount: 100 }),
        ),
      )

      expect(result.value).toBe(0)
      expect(result.splitAmongEnemies).toBe(true)
      expect(result.spellModifier).toEqual({
        type: 'spell',
        value: 0,
      })
    })

    it('allows formulas to disable player multipliers', () => {
      const result = assertDefined(
        threat({
          modifier: 0,
          bonus: 100,
          applyPlayerMultipliers: false,
        })(createMockContext()),
      )

      expect(result.applyPlayerMultipliers).toBe(false)
    })
  })

  describe('threatOnSuccessfulHit()', () => {
    it('applies threat on successful damage hits', () => {
      const result = assertDefined(
        threatOnSuccessfulHit({ bonus: 175 })(
          createMockContext({
            event: createDamageEvent({ hitType: HitTypeCode.Hit }),
            amount: 1000,
          }),
        ),
      )

      expect(result.value).toBe(1175)
      expect(result.spellModifier).toEqual({
        type: 'spell',
        bonus: 175,
      })
    })

    it('returns undefined on misses', () => {
      const result = threatOnSuccessfulHit({ bonus: 175 })(
        createMockContext({
          event: createDamageEvent({ hitType: HitTypeCode.Miss }),
          amount: 0,
        }),
      )

      expect(result).toBeUndefined()
    })
  })

  describe('tauntTarget()', () => {
    it('returns custom threat set effect with note and spell modifier', () => {
      const result = assertDefined(
        tauntTarget({ modifier: 1, bonus: 100 })(
          createMockContext({
            event: createApplyDebuffEvent(),
            amount: 300,
            actors: createMockActorContext({
              getThreat: () => 100,
              getTopActorsByThreat: () => [{ actorId: 99, threat: 500 }],
              isActorAlive: () => true,
            }),
          }),
        ),
      )

      expect(result.value).toBe(0)
      expect(result.note).toBe('taunt(topThreat+bonusThreat)')
      expect(result.spellModifier).toEqual({
        type: 'spell',
        bonus: 100,
      })
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
  })

  describe('modifyThreat()', () => {
    it('returns modifyThreat effect with multiplier note', () => {
      const result = assertDefined(
        modifyThreat({ modifier: 0.5 })(createMockContext()),
      )

      expect(result.value).toBe(0)
      expect(result.note).toBe('modifyThreat(0.5,target)')
      expect(result.effects?.[0]).toEqual({
        type: 'modifyThreat',
        multiplier: 0.5,
        target: 'target',
      })
    })

    it('returns wipe note for multiplier 0', () => {
      const result = assertDefined(
        modifyThreat({ modifier: 0 })(createMockContext()),
      )

      expect(result.note).toBe('threatWipe(target)')
      expect(result.effects?.[0]).toEqual({
        type: 'modifyThreat',
        multiplier: 0,
        target: 'target',
      })
    })
  })

  describe('modifyThreatOnHit()', () => {
    it('applies threat modification on matching damage hit types', () => {
      const result = assertDefined(
        modifyThreatOnHit(0.5)(
          createMockContext({
            event: createDamageEvent({ hitType: HitTypeCode.Hit }),
          }),
        ),
      )

      expect(result.effects?.[0]).toEqual({
        type: 'modifyThreat',
        multiplier: 0.5,
        target: 'target',
      })
    })

    it('ignores non-matching hit types', () => {
      const result = modifyThreatOnHit(0.5)(
        createMockContext({
          event: createDamageEvent({ hitType: HitTypeCode.Dodge }),
        }),
      )

      expect(result).toBeUndefined()
    })
  })

  describe('threatOnDebuffOrDamage()', () => {
    it('returns flat threat on debuff apply', () => {
      const result = assertDefined(
        threatOnDebuffOrDamage(120)(
          createMockContext({
            event: createApplyDebuffEvent(),
          }),
        ),
      )

      expect(result.value).toBe(120)
      expect(result.spellModifier).toEqual({
        type: 'spell',
        value: 0,
        bonus: 120,
      })
    })

    it('returns normal damage threat on damage events', () => {
      const result = assertDefined(
        threatOnDebuffOrDamage(120)(
          createMockContext({
            event: createDamageEvent(),
            amount: 345,
          }),
        ),
      )

      expect(result.value).toBe(345)
      expect(result.spellModifier).toBeUndefined()
    })

    it('returns undefined for unrelated events', () => {
      const result = threatOnDebuffOrDamage(120)(
        createMockContext({
          event: createCastEvent(),
        }),
      )

      expect(result).toBeUndefined()
    })
  })

  describe('threatOnDebuff()', () => {
    it('applies threat on apply/refresh/stack debuff phases', () => {
      const formula = threatOnDebuff(120)

      const applyResult = assertDefined(
        formula(
          createMockContext({
            event: createApplyDebuffEvent(),
          }),
        ),
      )
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

      expect(applyResult.spellModifier).toEqual({
        type: 'spell',
        value: 0,
        bonus: 120,
      })
      expect(refreshResult.value).toBe(120)
      expect(stackResult.value).toBe(120)
    })
  })

  describe('threatOnBuff()', () => {
    it('applies threat on apply/refresh/stack buff phases', () => {
      const formula = threatOnBuff(70, { split: true })

      const applyResult = assertDefined(
        formula(
          createMockContext({
            event: createApplyBuffEvent(),
          }),
        ),
      )
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

      expect(applyResult.value).toBe(70)
      expect(applyResult.spellModifier).toEqual({
        type: 'spell',
        value: 0,
        bonus: 70,
      })
      expect(refreshResult.value).toBe(70)
      expect(stackResult.value).toBe(70)
      expect(applyResult.splitAmongEnemies).toBe(true)
    })
  })

  describe('threatOnBuffOrDamage()', () => {
    it('uses buff flat threat or damage amount depending on event type', () => {
      const formula = threatOnBuffOrDamage(58)

      const buffResult = assertDefined(
        formula(
          createMockContext({
            event: createApplyBuffEvent(),
            amount: 999,
          }),
        ),
      )
      const damageResult = assertDefined(
        formula(
          createMockContext({
            event: createDamageEvent(),
            amount: 321,
          }),
        ),
      )

      expect(buffResult.value).toBe(58)
      expect(buffResult.spellModifier).toEqual({
        type: 'spell',
        value: 0,
        bonus: 58,
      })
      expect(damageResult.value).toBe(321)
      expect(damageResult.spellModifier).toBeUndefined()
    })
  })

  describe('threatOnCastRollbackOnMiss()', () => {
    it('applies cast threat and emits rollback threat on miss outcomes', () => {
      const formula = threatOnCastRollbackOnMiss(301)

      const castResult = assertDefined(
        formula(
          createMockContext({
            event: createCastEvent(),
          }),
        ),
      )
      const missResult = assertDefined(
        formula(
          createMockContext({
            event: createDamageEvent({ hitType: HitTypeCode.Miss }),
          }),
        ),
      )

      expect(castResult.value).toBe(301)
      expect(castResult.spellModifier).toEqual({
        type: 'spell',
        value: 0,
        bonus: 301,
      })
      expect(castResult.note).toBe('castThreat(rollbackOnMiss)')
      expect(missResult.value).toBe(-301)
      expect(missResult.spellModifier).toEqual({
        type: 'spell',
        value: 0,
        bonus: -301,
      })
      expect(missResult.note).toBe('castThreat(missRollback)')
    })

    it('returns undefined for non-cast/non-miss events', () => {
      const formula = threatOnCastRollbackOnMiss(301)

      expect(
        formula(
          createMockContext({
            event: createDamageEvent({ hitType: HitTypeCode.Hit }),
          }),
        ),
      ).toBeUndefined()
      expect(
        formula(
          createMockContext({
            event: createApplyDebuffEvent(),
          }),
        ),
      ).toBeUndefined()
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
            event: createDamageEvent({ hitType: HitTypeCode.Miss }),
          }),
        ),
      )

      expect(castResult.applyPlayerMultipliers).toBe(false)
      expect(rollbackResult.applyPlayerMultipliers).toBe(false)
    })
  })

  describe('noThreat()', () => {
    it('always returns undefined', () => {
      const formula = noThreat()
      const result = formula(createMockContext())

      expect(result).toBeUndefined()
    })
  })
})
