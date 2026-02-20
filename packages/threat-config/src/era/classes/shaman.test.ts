/**
 * Tests for Shaman Threat Configuration
 */
import {
  createDamageEvent,
  createHealEvent,
  createMockActorContext,
} from '@wow-threat/shared'
import type {
  TalentImplicationContext,
  ThreatContext,
} from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, shamanConfig } from './shaman'

function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: createHealEvent({ abilityGameID: 25357 }),
    amount: 100,
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestShaman', class: 'shaman' },
    targetActor: { id: 2, name: 'TestTarget', class: null },
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
    sourceActor: { id: 1, name: 'TestShaman', class: 'shaman' },
    talentPoints: [0, 0, 0],
    talentRanks: new Map(),
    specId: null,
    ...overrides,
  }
}

describe('Shaman Config', () => {
  describe('auraModifiers', () => {
    it('returns Healing Grace rank 3 modifier scoped to healing spells', () => {
      const modifierFn = shamanConfig.auraModifiers[Spells.HealingGraceRank3]
      expect(modifierFn).toBeDefined()

      const modifier = modifierFn!(createMockContext())

      expect(modifier.name).toBe('Healing Grace (Rank 3)')
      expect(modifier.value).toBeCloseTo(0.85, 6)
      expect(modifier.spellIds?.has(25357)).toBe(true)
    })
  })

  describe('talentImplications', () => {
    it('infers Healing Grace aura from ranked talent payload', () => {
      const result = shamanConfig.talentImplications!(
        createTalentContext({
          talentRanks: new Map([[Spells.HealingGraceRank2, 1]]),
        }),
      )

      expect(result).toEqual([Spells.HealingGraceRank2])
    })

    it('returns no synthetic aura when Healing Grace is absent', () => {
      const result = shamanConfig.talentImplications!(
        createTalentContext({
          talentRanks: new Map([[999999, 3]]),
        }),
      )

      expect(result).toEqual([])
    })
  })

  describe('abilities', () => {
    it('calculates Earth Shock with 2x threat', () => {
      const formula = shamanConfig.abilities[Spells.EarthShockR1]
      expect(formula).toBeDefined()

      const result = formula!(
        createMockContext({
          event: createDamageEvent(),
          amount: 250,
        }),
      )

      expect(result?.formula).toBe('amt * 2')
      expect(result?.value).toBe(500)
    })
  })
})
