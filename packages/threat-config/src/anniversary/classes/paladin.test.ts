/**
 * Tests for Paladin Threat Configuration
 */

import { describe, it, expect } from 'vitest'
import type { ThreatContext } from '../../types'
import { paladinConfig, Spells } from './paladin'

// Mock ThreatContext factory
function createMockContext(overrides: Partial<ThreatContext> = {}): ThreatContext {
  return {
    event: { type: 'damage' } as ThreatContext['event'],
    amount: 100,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestPaladin', class: 'paladin' },
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

describe('Paladin Config', () => {
  describe('auraModifiers', () => {
    it('returns Righteous Fury modifier limited to Holy school', () => {
      const modifierFn = paladinConfig.auraModifiers[Spells.RighteousFury]
      expect(modifierFn).toBeDefined()

      const modifier = modifierFn!(createMockContext())

      expect(modifier.name).toBe('Righteous Fury')
      expect(modifier.value).toBe(1.6)
      expect(modifier.schools).toBeDefined()
      expect(modifier.schools?.has('holy')).toBe(true)
      expect(modifier.schools?.size).toBe(1)
    })

    it('returns Blessing of Salvation modifier', () => {
      const modifierFn = paladinConfig.auraModifiers[Spells.BlessingOfSalvation]
      expect(modifierFn).toBeDefined()

      const modifier = modifierFn!(createMockContext())

      expect(modifier.name).toBe('Blessing of Salvation')
      expect(modifier.value).toBe(0.7)
      expect(modifier.source).toBe('buff')
    })
  })

  describe('abilities', () => {
    describe('Judgement of Light', () => {
      it('returns flat threat', () => {
        const formula = paladinConfig.abilities[Spells.JudgementOfLight]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = formula!(ctx)

        expect(result.formula).toBe('194')
        expect(result.value).toBe(194)
      })
    })

    describe('Holy Shield', () => {
      it('returns damage + flat threat', () => {
        const formula = paladinConfig.abilities[Spells.HolyShield]
        expect(formula).toBeDefined()

        const ctx = createMockContext({ amount: 50 })
        const result = formula!(ctx)

        expect(result.formula).toBe('amt + 35')
        expect(result.value).toBe(85) // 50 + 35
      })
    })
  })

  describe('invulnerabilityBuffs', () => {
    it('includes Divine Shield and BoP', () => {
      expect(paladinConfig.invulnerabilityBuffs).toBeDefined()
      // Divine Shield
      expect(paladinConfig.invulnerabilityBuffs?.has(642)).toBe(true)
      // Blessing of Protection
      expect(paladinConfig.invulnerabilityBuffs?.has(10278)).toBe(true)
    })
  })
})
