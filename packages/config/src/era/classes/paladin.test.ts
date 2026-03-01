/**
 * Tests for Paladin Threat Configuration
 */
import {
  createApplyBuffEvent,
  createDamageEvent,
  createMockActorContext,
} from '@wow-threat/shared'
import type {
  TalentImplicationContext,
  ThreatContext,
} from '@wow-threat/shared/src/types'
import { SpellSchool } from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, exclusiveAuras, paladinConfig } from './paladin'

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
    event: createDamageEvent(),
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
  describe('exclusiveAuras', () => {
    it('defines one exclusive set per blessing family', () => {
      expect(exclusiveAuras).toHaveLength(6)
      expect(exclusiveAuras.every((set) => set.size === 2)).toBe(true)
    })

    it('pairs Blessing of Kings with Greater Blessing of Kings', () => {
      expect(
        exclusiveAuras.some(
          (set) =>
            set.has(Spells.BlessingOfKings) &&
            set.has(Spells.GreaterBlessingOfKings),
        ),
      ).toBe(true)
    })

    it('pairs Blessing of Salvation with Greater Blessing of Salvation', () => {
      expect(
        exclusiveAuras.some(
          (set) =>
            set.has(Spells.BlessingOfSalvation) &&
            set.has(Spells.GreaterBlessingOfSalvation),
        ),
      ).toBe(true)
    })

    it('pairs Blessing of Might with Greater Blessing of Might', () => {
      expect(
        exclusiveAuras.some(
          (set) =>
            set.has(Spells.BlessingOfMightR7) &&
            set.has(Spells.GreaterBlessingOfMight),
        ),
      ).toBe(true)
    })

    it('pairs Blessing of Wisdom with Greater Blessing of Wisdom', () => {
      expect(
        exclusiveAuras.some(
          (set) =>
            set.has(Spells.BlessingOfWisdomR6) &&
            set.has(Spells.GreaterBlessingOfWisdom),
        ),
      ).toBe(true)
    })

    it('pairs Blessing of Sanctuary with Greater Blessing of Sanctuary', () => {
      expect(
        exclusiveAuras.some(
          (set) =>
            set.has(Spells.BlessingOfSanctuaryR4) &&
            set.has(Spells.GreaterBlessingOfSanctuary),
        ),
      ).toBe(true)
    })

    it('keeps Blessing of Light isolated from Blessing of Salvation family', () => {
      expect(
        exclusiveAuras.some(
          (set) =>
            set.has(Spells.BlessingOfLightR3) &&
            set.has(Spells.GreaterBlessingOfSalvation),
        ),
      ).toBe(false)
    })
  })

  describe('auraModifiers', () => {
    it('returns Righteous Fury modifier limited to Holy school', () => {
      const modifierFn = paladinConfig.auraModifiers[Spells.RighteousFury]
      expect(modifierFn).toBeDefined()

      const modifier = modifierFn!(createMockContext())

      expect(modifier.name).toBe('Righteous Fury')
      expect(modifier.value).toBe(1.6)
      expect(modifier.schoolMask).toBe(SpellSchool.Holy)
    })

    it('returns Blessing of Salvation modifier', () => {
      const modifierFn = paladinConfig.auraModifiers[Spells.BlessingOfSalvation]
      expect(modifierFn).toBeDefined()

      const modifier = modifierFn!(createMockContext())

      expect(modifier.name).toBe('Blessing of Salvation')
      expect(modifier.value).toBe(0.7)
      expect(modifier.source).toBe('buff')
    })

    it('applies Improved Righteous Fury only when Righteous Fury is active', () => {
      const modifierFn =
        paladinConfig.auraModifiers[Spells.ImprovedRighteousFuryR3]
      expect(modifierFn).toBeDefined()

      const withoutRighteousFury = modifierFn!(createMockContext())
      const withRighteousFury = modifierFn!(
        createMockContext({
          sourceAuras: new Set([
            Spells.RighteousFury,
            Spells.ImprovedRighteousFuryR3,
          ]),
        }),
      )

      expect(withoutRighteousFury.value).toBe(1)
      expect(withRighteousFury.value).toBeCloseTo(1.1875, 6)
      expect(withRighteousFury.schoolMask).toBe(SpellSchool.Holy)
    })
  })

  describe('talentImplications', () => {
    function createTalentContext(
      overrides: Partial<TalentImplicationContext> = {},
    ): TalentImplicationContext {
      return {
        event: {
          timestamp: 0,
          type: 'combatantinfo',
          sourceID: 1,
          targetID: 1,
        },
        sourceActor: { id: 1, name: 'TestPaladin', class: 'paladin' },
        talentPoints: [0, 0, 0],
        talentRanks: new Map(),
        specId: null,
        ...overrides,
      }
    }

    it('infers Improved Righteous Fury from ranked talent payload', () => {
      const result = paladinConfig.talentImplications!(
        createTalentContext({
          talentRanks: new Map([[Spells.ImprovedRighteousFuryR2, 1]]),
        }),
      )

      expect(result).toEqual([Spells.ImprovedRighteousFuryR2])
    })

    it('infers Improved Righteous Fury rank 3 from protection tree split threshold', () => {
      const result = paladinConfig.talentImplications!(
        createTalentContext({
          talentPoints: [20, 13, 18],
        }),
      )

      expect(result).toContain(Spells.ImprovedRighteousFuryR3)
    })

    it('infers Vengeance rank 5 from retribution tree split threshold', () => {
      const result = paladinConfig.talentImplications!(
        createTalentContext({
          talentPoints: [0, 13, 30],
        }),
      )

      expect(result).toContain(Spells.VengeanceR5)
    })

    it('does not infer Improved Righteous Fury below protection threshold', () => {
      const result = paladinConfig.talentImplications!(
        createTalentContext({
          talentPoints: [0, 12, 30],
        }),
      )

      expect(result).not.toContain(Spells.ImprovedRighteousFuryR3)
      expect(result).toContain(Spells.VengeanceR5)
    })

    it('returns no synthetic aura when configured talent signals are absent', () => {
      const result = paladinConfig.talentImplications!(
        createTalentContext({
          talentRanks: new Map([[999999, 3]]),
          talentPoints: [12, 12, 29],
        }),
      )

      expect(result).toEqual([])
    })
  })

  describe('abilities', () => {
    describe('Judgement of Light', () => {
      it('returns flat threat', () => {
        const formula = paladinConfig.abilities[Spells.JudgementOfLight]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = assertDefined(formula!(ctx))

        expect(result.spellModifier).toEqual({
          type: 'spell',
          value: 0,
          bonus: 194,
        })
        expect(result.value).toBe(194)
      })
    })

    describe('Holy Shield', () => {
      it('returns damage + flat threat', () => {
        const formula = paladinConfig.abilities[Spells.HolyShield]
        expect(formula).toBeDefined()

        const ctx = createMockContext({ amount: 50 })
        const result = assertDefined(formula!(ctx))

        expect(result.spellModifier).toEqual({
          type: 'spell',
          bonus: 35,
        })
        expect(result.value).toBe(85) // 50 + 35
      })
    })

    describe('Blessing of Kings', () => {
      it('returns split threat on buff application', () => {
        const formula = paladinConfig.abilities[Spells.BlessingOfKings]
        expect(formula).toBeDefined()

        const ctx = createMockContext({
          event: createApplyBuffEvent(),
        })
        const result = assertDefined(formula!(ctx))

        expect(result.spellModifier).toEqual({
          type: 'spell',
          value: 0,
          bonus: 60,
        })
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
