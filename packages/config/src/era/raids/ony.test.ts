/**
 * Onyxia Boss Abilities Tests
 */
import { createDamageEvent, createMockActorContext } from '@wow-threat/shared'
import type { ThreatContext } from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, onyxiaAbilities } from './ony'

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
  return {
    event: createDamageEvent({ abilityGameID: Spells.KnockAway }),
    amount: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'Onyxia', class: null },
    targetActor: { id: 2, name: 'Tank', class: 'warrior' },
    encounterId: null,
    spellSchoolMask: 0,
    actors: createMockActorContext(),
    ...overrides,
  }
}

const knockAway = onyxiaAbilities[Spells.KnockAway]

describe('Onyxia Abilities', () => {
  describe('Spell constants', () => {
    it('has correct spell ID for Knock Away', () => {
      expect(Spells.KnockAway).toBe(19633)
    })
  })

  describe('Knock Away', () => {
    it('returns modifyThreat special with 0.75 multiplier', () => {
      const result = assertDefined(knockAway(createMockContext()))

      expect(result.effects?.[0]?.type).toBe('modifyThreat')
      if (result.effects?.[0]?.type === 'modifyThreat') {
        expect(result.effects?.[0]?.multiplier).toBe(0.75)
      }
    })

    it('adds a descriptive note', () => {
      const result = assertDefined(knockAway(createMockContext()))
      expect(result.note).toBe('modifyThreat(0.75,target)')
    })

    it('returns zero base threat value', () => {
      const result = assertDefined(knockAway(createMockContext()))
      expect(result.value).toBe(0)
    })

    it('does not split among enemies', () => {
      const result = assertDefined(knockAway(createMockContext()))
      expect(result.splitAmongEnemies).toBe(false)
    })

    it('reduces threat by 25% (multiplies by 0.75)', () => {
      // This test verifies the math: if threat is 1000, it becomes 750 (25% reduction)
      const result = assertDefined(knockAway(createMockContext()))
      expect(result.effects?.[0]?.type).toBe('modifyThreat')
      if (result.effects?.[0]?.type === 'modifyThreat') {
        // Example: 1000 threat * 0.75 = 750 threat (reduced by 250, or 25%)
        expect(result.effects?.[0]?.multiplier).toBe(0.75)
      }
    })
  })
})
