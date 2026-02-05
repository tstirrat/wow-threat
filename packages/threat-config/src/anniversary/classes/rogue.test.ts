/**
 * Tests for Rogue Threat Configuration
 */

import { describe, it, expect } from 'vitest'
import type { ThreatContext } from '../../types'
import { rogueConfig, Spells } from './rogue'

// Mock ThreatContext factory
function createMockContext(overrides: Partial<ThreatContext> = {}): ThreatContext {
  return {
    event: { type: 'damage' } as ThreatContext['event'],
    amount: 100,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestRogue', class: 'rogue' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: {
      getPosition: () => null,
      getDistance: () => null,
      getActorsInRange: () => [],
      getThreat: () => 0,
      getTopActorsByThreat: () => [],
    },
    ...overrides,
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
        const result = formula!(ctx)

        expect(result.formula).toBe('-150')
        expect(result.value).toBe(-150)
      })
    })

    describe('Vanish', () => {
      it('returns threat drop', () => {
        const formula = rogueConfig.abilities[Spells.VanishR1]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = formula!(ctx)

        expect(result.special).toEqual({ type: 'modifyThreat', multiplier: 0 })
      })
    })
  })
})
