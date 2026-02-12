/**
 * Tests for Druid Threat Configuration
 */
import { createMockActorContext } from '@wcl-threat/shared'
import type {
  TalentImplicationContext,
  ThreatContext,
} from '@wcl-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, druidConfig, exclusiveAuras } from './druid'

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
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestDruid', class: 'druid' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
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

    it('returns feral instinct additive modifier in bear form', () => {
      const modifierFn = druidConfig.auraModifiers[Spells.FeralInstinctRank5]
      expect(modifierFn).toBeDefined()

      const modifier = modifierFn!(
        createMockContext({ sourceAuras: new Set([Spells.BearForm]) }),
      )

      expect(modifier.name).toBe('Feral Instinct (Rank 5)')
      expect(modifier.value).toBeCloseTo((1.3 + 0.15) / 1.3, 6)
      expect(modifier.source).toBe('talent')
    })

    it('returns neutral feral instinct modifier outside bear form', () => {
      const modifierFn = druidConfig.auraModifiers[Spells.FeralInstinctRank3]
      expect(modifierFn).toBeDefined()

      const modifier = modifierFn!(
        createMockContext({ sourceAuras: new Set([Spells.CatForm]) }),
      )

      expect(modifier.value).toBe(1)
    })

    it('returns subtlety rank 5 modifier scoped to healing spells', () => {
      const modifierFn = druidConfig.auraModifiers[Spells.SubtletyRank5]
      expect(modifierFn).toBeDefined()

      const modifier = modifierFn!(createMockContext())

      expect(modifier.name).toBe('Subtlety (Rank 5)')
      expect(modifier.value).toBe(0.8)
      expect(modifier.source).toBe('talent')
      expect(modifier.spellIds).toBeDefined()
      expect(modifier.spellIds?.has(5185)).toBe(true)
    })
  })

  describe('abilities', () => {
    describe('Maul', () => {
      it('calculates amount * 1.75 threat', () => {
        const formula = druidConfig.abilities[Spells.MaulR1]
        expect(formula).toBeDefined()

        const ctx = createMockContext({ amount: 1000 })
        const result = assertDefined(formula!(ctx))

        expect(result.formula).toBe('amt * 1.75')
        expect(result.value).toBe(1750)
      })
    })

    describe('Swipe', () => {
      it('calculates amount * 1.75 threat', () => {
        const formula = druidConfig.abilities[Spells.SwipeR1] // R1
        expect(formula).toBeDefined()

        const ctx = createMockContext({ amount: 100 })
        const result = assertDefined(formula!(ctx))

        expect(result.formula).toBe('amt * 1.75')
        expect(result.value).toBe(175)
      })
    })

    describe('Growl', () => {
      it('returns taunt behavior', () => {
        const formula = druidConfig.abilities[Spells.Growl]
        expect(formula).toBeDefined()

        const ctx = createMockContext({
          event: { type: 'applydebuff' } as ThreatContext['event'],
          actors: createMockActorContext({
            getThreat: () => 100,
            getTopActorsByThreat: () => [{ actorId: 99, threat: 500 }],
            isActorAlive: () => true,
          }),
        })
        const result = assertDefined(formula!(ctx))

        expect(result.formula).toBe('topThreat + 0')
        expect(result.effects?.[0]).toEqual({
          type: 'customThreat',
          changes: [
            {
              sourceId: 1,
              targetId: 2,
              targetInstance: 0,
              operator: 'set',
              amount: 500,
              total: 500,
            },
          ],
        })
      })
    })

    describe('Cower', () => {
      it('applies negative threat on cast and rolls back on miss', () => {
        const formula = druidConfig.abilities[Spells.CowerR1]
        expect(formula).toBeDefined()

        const castResult = formula!(
          createMockContext({
            event: { type: 'cast' } as ThreatContext['event'],
          }),
        )
        const missResult = formula!(
          createMockContext({
            event: {
              type: 'damage',
              hitType: 'miss',
            } as ThreatContext['event'],
          }),
        )

        expect(castResult?.formula).toBe('-240 (cast)')
        expect(castResult?.value).toBe(-240)
        expect(missResult?.formula).toBe('240 (miss rollback)')
        expect(missResult?.value).toBe(240)
      })
    })

    describe('Faerie Fire (Feral)', () => {
      it('returns flat threat on debuff', () => {
        const formula = druidConfig.abilities[Spells.FaerieFireFeralR1]
        expect(formula).toBeDefined()

        const ctx = createMockContext({
          event: { type: 'applydebuff' } as ThreatContext['event'],
        })
        const result = assertDefined(formula!(ctx))

        expect(result.formula).toBe('108')
        expect(result.value).toBe(108)
      })
    })

    describe('Forms (Shapechange)', () => {
      it('returns zero threat for form change', () => {
        // e.g. shifting into Bear Form itself causes no threat
        const formula = druidConfig.abilities[Spells.BearForm]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = assertDefined(formula!(ctx))

        expect(result.value).toBe(0)
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

  describe('auraImplications', () => {
    it('maps rake casts to implied cat form', () => {
      const catFormImplications = druidConfig.auraImplications?.get(
        Spells.CatForm,
      )

      expect(catFormImplications).toBeDefined()
      expect(catFormImplications?.has(Spells.Rake)).toBe(true)
    })

    it('maps maul casts to implied dire bear form', () => {
      const direBearImplications = druidConfig.auraImplications?.get(
        Spells.DireBearForm,
      )

      expect(direBearImplications).toBeDefined()
      expect(direBearImplications?.has(Spells.MaulR1)).toBe(true)
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
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
        },
        sourceActor: { id: 1, name: 'TestDruid', class: 'druid' },
        talentPoints: [0, 0, 0],
        talentRanks: new Map(),
        specId: null,
        ...overrides,
      }
    }

    it('infers Feral Instinct aura from ranked talent payload', () => {
      const result = druidConfig.talentImplications!(
        createTalentContext({
          talentRanks: new Map([[Spells.FeralInstinctRank4, 1]]),
        }),
      )

      expect(result).toEqual([Spells.FeralInstinctRank4])
    })

    it('infers Feral Instinct rank 5 from bear-form feral split at threshold', () => {
      const result = druidConfig.talentImplications!(
        createTalentContext({
          event: {
            timestamp: 0,
            type: 'combatantinfo',
            sourceID: 1,
            sourceIsFriendly: true,
            targetID: 1,
            targetIsFriendly: true,
            auras: [
              {
                source: 1,
                ability: Spells.DireBearForm,
                stacks: 1,
                icon: 'ability_racial_bearform.jpg',
              },
            ],
          },
          talentPoints: [44, 7, 0],
        }),
      )

      expect(result).toEqual([Spells.FeralInstinctRank5])
    })

    it('does not infer Feral Instinct when bear-form feral split is below threshold', () => {
      const result = druidConfig.talentImplications!(
        createTalentContext({
          event: {
            timestamp: 0,
            type: 'combatantinfo',
            sourceID: 1,
            sourceIsFriendly: true,
            targetID: 1,
            targetIsFriendly: true,
            auras: [
              {
                source: 1,
                ability: Spells.BearForm,
                stacks: 1,
                icon: 'ability_racial_bearform.jpg',
              },
            ],
          },
          talentPoints: [0, 6, 14],
        }),
      )

      expect(result).toEqual([])
    })

    it('does not infer Feral Instinct from non-bear split even above threshold', () => {
      const result = druidConfig.talentImplications!(
        createTalentContext({
          talentPoints: [0, 20, 14],
        }),
      )

      expect(result).toEqual([])
    })

    it('prefers explicit ranked talent payload over tree-split inference', () => {
      const result = druidConfig.talentImplications!(
        createTalentContext({
          event: {
            timestamp: 0,
            type: 'combatantinfo',
            sourceID: 1,
            sourceIsFriendly: true,
            targetID: 1,
            targetIsFriendly: true,
            auras: [
              {
                source: 1,
                ability: Spells.BearForm,
                stacks: 1,
                icon: 'ability_racial_bearform.jpg',
              },
            ],
          },
          talentPoints: [0, 20, 14],
          talentRanks: new Map([[Spells.FeralInstinctRank2, 1]]),
        }),
      )

      expect(result).toEqual([Spells.FeralInstinctRank2])
    })

    it('infers Subtlety aura from ranked talent payload', () => {
      const result = druidConfig.talentImplications!(
        createTalentContext({
          talentRanks: new Map([[Spells.SubtletyRank3, 1]]),
        }),
      )

      expect(result).toEqual([Spells.SubtletyRank3])
    })

    it('infers Subtlety rank 5 from restoration split threshold', () => {
      const result = druidConfig.talentImplications!(
        createTalentContext({
          talentPoints: [31, 5, 15],
        }),
      )

      expect(result).toEqual([Spells.SubtletyRank5])
    })

    it('does not infer Subtlety when restoration split is below threshold', () => {
      const result = druidConfig.talentImplications!(
        createTalentContext({
          talentPoints: [31, 6, 14],
        }),
      )

      expect(result).toEqual([])
    })

    it('prefers explicit Subtlety rank over tree-split inference', () => {
      const result = druidConfig.talentImplications!(
        createTalentContext({
          talentPoints: [0, 0, 15],
          talentRanks: new Map([[Spells.SubtletyRank2, 1]]),
        }),
      )

      expect(result).toEqual([Spells.SubtletyRank2])
    })

    it('returns no synthetic aura when Feral Instinct is absent', () => {
      const result = druidConfig.talentImplications!(
        createTalentContext({
          talentRanks: new Map([[999999, 3]]),
        }),
      )

      expect(result).toEqual([])
    })
  })
})
