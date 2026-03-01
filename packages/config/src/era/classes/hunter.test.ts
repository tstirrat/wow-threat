/**
 * Tests for Era Hunter Threat Configuration
 */
import { createDamageEvent, createMockActorContext } from '@wow-threat/shared'
import type { ThreatContext } from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { createCastContext } from '../../test/helpers/context'
import { Spells, hunterConfig } from './hunter'

function assertDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined()
  if (value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: createDamageEvent({ sourceID: 1, targetID: 2 }),
    amount: 100,
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestHunter', class: 'hunter' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...overrides,
  }
}

describe('era hunter config', () => {
  describe('abilities', () => {
    it('returns threat drop (0 multiplier) for feign death', () => {
      const formula = hunterConfig.abilities[Spells.FeignDeath]
      const result = assertDefined(formula?.(createMockContext()))

      expect(result.effects?.[0]).toEqual({
        type: 'modifyThreat',
        multiplier: 0,
        target: 'all',
      })
    })

    it('returns damage plus bonus threat for distracting shot', () => {
      const formula = hunterConfig.abilities[Spells.DistractingShotR1]
      const result = assertDefined(
        formula?.(
          createCastContext({
            abilityGameID: Spells.DistractingShotR1,
          }),
        ),
      )

      expect(result.spellModifier).toEqual({
        type: 'spell',
        bonus: 110,
      })
      expect(result.value).toBe(110)
    })

    it('returns negative threat for disengage', () => {
      const formula = hunterConfig.abilities[Spells.DisengageR1]
      const result = assertDefined(formula?.(createMockContext()))

      expect(result.spellModifier).toEqual({
        type: 'spell',
        value: 0,
        bonus: -140,
      })
      expect(result.value).toBe(-140)
    })
  })
})
