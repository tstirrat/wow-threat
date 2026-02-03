/**
 * Tests for Druid Threat Configuration
 */

import { describe, it, expect } from 'vitest'
import type { ThreatContext } from '../../types'
import { druidConfig, Spells, exclusiveAuras } from './druid'

// Mock ThreatContext factory
function createMockContext(overrides: Partial<ThreatContext> = {}): ThreatContext {
  return {
    event: { type: 'damage' } as ThreatContext['event'],
    amount: 100,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    enemies: [],
    sourceActor: { id: 1, name: 'TestDruid', class: 'druid' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    ...overrides,
  }
}

describe('Druid Config', () => {
  describe('auraModifiers', () => {
    it('returns Bear Form modifier', () => {
      const modifierFn = druidConfig.auraModifiers[Spells.BearForm]
      expect(modifierFn).toBeDefined()

      const modifier = modifierFn!(createMockContext())

      expect(modifier.name).toBe('Bear Form')
      expect(modifier.value).toBe(1.3)
      expect(modifier.source).toBe('class')
    })

    it('returns Cat Form modifier', () => {
      const modifierFn = druidConfig.auraModifiers[Spells.CatForm]
      expect(modifierFn).toBeDefined()

      const modifier = modifierFn!(createMockContext())

      expect(modifier.name).toBe('Cat Form')
      expect(modifier.value).toBe(0.71)
      expect(modifier.source).toBe('class')
    })
  })

  describe('abilities', () => {
    describe('Maul', () => {
      it('calculates amount * 1.75 threat', () => {
        const formula = druidConfig.abilities[Spells.MaulR1]
        expect(formula).toBeDefined()

        const ctx = createMockContext({ amount: 1000 })
        const result = formula!(ctx)

        expect(result.formula).toBe('amt * 1.75')
        expect(result.baseThreat).toBe(1750)
      })
    })

    describe('Swipe', () => {
      it('calculates amount * 1.75 threat', () => {
        const formula = druidConfig.abilities[Spells.SwipeR1] // R1
        expect(formula).toBeDefined()

        const ctx = createMockContext({ amount: 100 })
        const result = formula!(ctx)

        expect(result.formula).toBe('amt * 1.75')
        expect(result.baseThreat).toBe(175)
      })
    })

    describe('Growl', () => {
      it('returns taunt behavior', () => {
        const formula = druidConfig.abilities[Spells.Growl]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = formula!(ctx)

        expect(result.formula).toBe('topThreat + 0')
        expect(result.special).toEqual({ type: 'taunt', fixateDuration: 3000 })
      })
    })

    describe('Cower', () => {
      it('returns negative threat', () => {
        const formula = druidConfig.abilities[Spells.CowerR1]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = formula!(ctx)

        expect(result.formula).toBe('-240')
        expect(result.baseThreat).toBe(-240)
      })
    })

    describe('Faerie Fire (Feral)', () => {
      it('returns flat threat on debuff', () => {
        const formula = druidConfig.abilities[Spells.FaerieFireFeralR1]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = formula!(ctx)

        expect(result.formula).toBe('108')
        expect(result.baseThreat).toBe(108)
      })
    })

    describe('Forms (Shapechange)', () => {
      it('returns zero threat for form change', () => {
        // e.g. shifting into Bear Form itself causes no threat
        const formula = druidConfig.abilities[Spells.BearForm]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = formula!(ctx)

        expect(result.baseThreat).toBe(0)
      })
    })
  })

  describe('fixateBuffs', () => {
    it('includes Growl and Challenging Roar', () => {
      expect(druidConfig.fixateBuffs).toBeDefined()
      expect(druidConfig.fixateBuffs?.has(Spells.Growl)).toBe(true)
      expect(druidConfig.fixateBuffs?.has(Spells.ChallengingRoar)).toBe(true)
    })
  })

  describe('exclusiveAuras', () => {
    it('defines mutually exclusive druid forms', () => {
      expect(exclusiveAuras).toHaveLength(1)
      expect(exclusiveAuras[0]!.has(Spells.BearForm)).toBe(true)
      expect(exclusiveAuras[0]!.has(Spells.DireBearForm)).toBe(true)
      expect(exclusiveAuras[0]!.has(Spells.CatForm)).toBe(true)
      expect(exclusiveAuras[0]!.has(Spells.MoonkinForm)).toBe(true)
    })
  })
})
