/**
 * Tests for Rogue Threat Configuration
 */
import { createDamageEvent, createMockActorContext } from '@wow-threat/shared'
import type { ThreatContext } from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, rogueConfig } from './rogue'

function assertDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined()
  if (value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

// Mock ThreatContext factory
function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  const { spellSchoolMask, ...restOverrides } = overrides

  return {
    event: createDamageEvent(),
    amount: 100,
    spellSchoolMask: spellSchoolMask ?? 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestRogue', class: 'rogue' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...restOverrides,
  }
}

describe('Rogue Config', () => {
  describe('baseThreatFactor', () => {
    it('sets base threat factor to 0.71', () => {
      expect(rogueConfig.baseThreatFactor).toBe(0.71)
    })
  })

  describe('abilities', () => {
    describe('Feint', () => {
      it('returns negative threat', () => {
        const formula = rogueConfig.abilities[Spells.FeintR1]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = assertDefined(formula!(ctx))

        expect(result.formula).toBe('-150')
        expect(result.value).toBe(-150)
      })
    })

    describe('Vanish', () => {
      it('returns threat drop', () => {
        const formula = rogueConfig.abilities[Spells.VanishR1]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = assertDefined(formula!(ctx))

        expect(result.effects?.[0]).toEqual({
          type: 'modifyThreat',
          multiplier: 0,
          target: 'all',
        })
      })
    })
  })
})
