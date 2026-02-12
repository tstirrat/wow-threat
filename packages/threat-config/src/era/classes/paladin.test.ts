/**
 * Tests for Paladin Threat Configuration
 */
import { createMockActorContext } from '@wcl-threat/shared'
import { SpellSchool, type ThreatContext } from '@wcl-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, paladinConfig } from './paladin'

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
    event: { type: 'damage' } as ThreatContext['event'],
    amount: 100,
    spellSchoolMask: SpellSchool.Physical,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestPaladin', class: 'paladin' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
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
      expect(modifier.schools?.has(SpellSchool.Holy)).toBe(true)
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
        const result = assertDefined(formula!(ctx))

        expect(result.formula).toBe('194')
        expect(result.value).toBe(194)
      })
    })

    describe('Holy Shield', () => {
      it('returns damage + flat threat', () => {
        const formula = paladinConfig.abilities[Spells.HolyShield]
        expect(formula).toBeDefined()

        const ctx = createMockContext({ amount: 50 })
        const result = assertDefined(formula!(ctx))

        expect(result.formula).toBe('amt + 35')
        expect(result.value).toBe(85) // 50 + 35
      })
    })

    describe('Blessing of Kings', () => {
      it('returns split threat on buff application', () => {
        const formula = paladinConfig.abilities[Spells.BlessingOfKings]
        expect(formula).toBeDefined()

        const ctx = createMockContext({
          event: { type: 'applybuff' } as ThreatContext['event'],
        })
        const result = assertDefined(formula!(ctx))

        expect(result.formula).toBe('60')
        expect(result.value).toBe(60)
        expect(result.splitAmongEnemies).toBe(true)
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
