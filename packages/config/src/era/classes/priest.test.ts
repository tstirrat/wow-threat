/**
 * Tests for Priest Threat Configuration
 */
import { createDamageEvent, createMockActorContext } from '@wow-threat/shared'
import type {
  TalentImplicationContext,
  ThreatContext,
} from '@wow-threat/shared/src/types'
import { SpellSchool } from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, priestConfig } from './priest'

function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: createDamageEvent({ abilityGameID: Spells.MindBlastR1 }),
    amount: 100,
    spellSchoolMask: SpellSchool.Physical,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestPriest', class: 'priest' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...overrides,
  }
}

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
    sourceActor: { id: 1, name: 'TestPriest', class: 'priest' },
    talentPoints: [0, 0, 0],
    talentRanks: new Map(),
    specId: null,
    ...overrides,
  }
}

describe('Priest Config', () => {
  describe('abilities', () => {
    it('calculates Mind Blast with flat threat bonus', () => {
      const formula = priestConfig.abilities[Spells.MindBlastR1]
      expect(formula).toBeDefined()

      const result = formula!(createMockContext({ amount: 300 }))

      expect(result?.spellModifier).toEqual({
        type: 'spell',
        bonus: 40,
      })
      expect(result?.value).toBe(340)
    })
  })

  describe('auraModifiers', () => {
    it('returns Shadow Affinity rank 3 shadow-only modifier', () => {
      const modifierFn = priestConfig.auraModifiers[Spells.ShadowAffinityRank3]
      expect(modifierFn).toBeDefined()

      const modifier = modifierFn!(
        createMockContext({ spellSchoolMask: SpellSchool.Shadow }),
      )

      expect(modifier.name).toBe('Shadow Affinity (Rank 3)')
      expect(modifier.value).toBeCloseTo(0.75, 6)
      expect(modifier.schoolMask).toBe(SpellSchool.Shadow)
    })
  })

  describe('talentImplications', () => {
    it('infers both priest threat talent auras', () => {
      const result = priestConfig.talentImplications!(
        createTalentContext({
          talentRanks: new Map([
            [Spells.SilentResolveRank5, 1],
            [Spells.ShadowAffinityRank3, 1],
          ]),
        }),
      )

      expect(result).toEqual([
        Spells.SilentResolveRank5,
        Spells.ShadowAffinityRank3,
      ])
    })

    it('returns no synthetic aura when tracked talents are absent', () => {
      const result = priestConfig.talentImplications!(
        createTalentContext({
          talentRanks: new Map([[999999, 3]]),
        }),
      )

      expect(result).toEqual([])
    })
  })
})
