/**
 * Tests for Mage Threat Configuration
 */
import { createMockActorContext } from '@wcl-threat/shared'
import type {
  TalentImplicationContext,
  ThreatContext,
} from '@wcl-threat/shared/src/types'
import { SpellSchool } from '@wcl-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, mageConfig } from './mage'

function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: { type: 'damage', abilityGameID: 0 } as ThreatContext['event'],
    amount: 100,
    spellSchoolMask: SpellSchool.Physical,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestMage', class: 'mage' },
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
      sourceIsFriendly: true,
      targetID: 1,
      targetIsFriendly: true,
    },
    sourceActor: { id: 1, name: 'TestMage', class: 'mage' },
    talentPoints: [0, 0, 0],
    talentRanks: new Map(),
    specId: null,
    ...overrides,
  }
}

describe('Mage Config', () => {
  describe('auraModifiers', () => {
    it('returns Arcane Subtlety rank 2 modifier', () => {
      const modifierFn = mageConfig.auraModifiers[Spells.ArcaneSubtletyRank2]
      expect(modifierFn).toBeDefined()

      const modifier = modifierFn!(
        createMockContext({ spellSchoolMask: SpellSchool.Arcane }),
      )

      expect(modifier.name).toBe('Arcane Subtlety (Rank 2)')
      expect(modifier.value).toBe(0.6)
      expect(modifier.source).toBe('talent')
      expect(modifier.schools?.has(SpellSchool.Arcane)).toBe(true)
    })
  })

  describe('talentImplications', () => {
    it('infers all configured mage talent auras', () => {
      const result = mageConfig.talentImplications!(
        createTalentContext({
          talentRanks: new Map([
            [Spells.ArcaneSubtletyRank2, 1],
            [Spells.BurningSoulRank2, 1],
            [Spells.FrostChannelingRank3, 1],
          ]),
        }),
      )

      expect(result).toEqual([
        Spells.ArcaneSubtletyRank2,
        Spells.BurningSoulRank2,
        Spells.FrostChannelingRank3,
      ])
    })

    it('infers Burning Soul rank 2 from fire tree split threshold', () => {
      const result = mageConfig.talentImplications!(
        createTalentContext({
          talentPoints: [0, 12, 39],
        }),
      )

      expect(result).toEqual([Spells.BurningSoulRank2])
    })

    it('does not infer Burning Soul when fire tree points are below threshold', () => {
      const result = mageConfig.talentImplications!(
        createTalentContext({
          talentPoints: [20, 11, 20],
        }),
      )

      expect(result).toEqual([])
    })

    it('prefers explicit Burning Soul rank over tree-split inference', () => {
      const result = mageConfig.talentImplications!(
        createTalentContext({
          talentPoints: [0, 12, 39],
          talentRanks: new Map([[Spells.BurningSoulRank1, 1]]),
        }),
      )

      expect(result).toEqual([Spells.BurningSoulRank1])
    })

    it('returns no synthetic aura when tracked talents are absent', () => {
      const result = mageConfig.talentImplications!(
        createTalentContext({
          talentRanks: new Map([[999999, 3]]),
        }),
      )

      expect(result).toEqual([])
    })
  })
})
