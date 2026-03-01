/**
 * Tests for Warlock Threat Configuration
 */
import {
  createApplyDebuffEvent,
  createDamageEvent,
  createMockActorContext,
} from '@wow-threat/shared'
import type { ThreatContext } from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Mods, Spells, warlockConfig } from './warlock'

function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: createDamageEvent({ abilityGameID: Spells.CurseOfDoom }),
    amount: 100,
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestWarlock', class: 'warlock' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...overrides,
  }
}

describe('Warlock Config', () => {
  describe('pet aura implications', () => {
    it('maps summon imp and firebolt to the imp active synthetic aura', () => {
      const implicationSpells = warlockConfig.petAuraImplications?.get(
        Spells.ImpActive,
      )

      expect(implicationSpells).toBeDefined()
      expect(implicationSpells?.has(Spells.SummonImp)).toBe(true)
      expect(implicationSpells?.has(Spells.FireboltR1)).toBe(true)
      expect(implicationSpells?.has(Spells.FireboltR8)).toBe(true)
    })
  })

  describe('aura modifiers', () => {
    it('applies master demonologist', () => {
      const modifier = warlockConfig.auraModifiers[Spells.MasterDemonologistR5]
      expect(modifier).toBeDefined()

      const result = modifier!(
        createMockContext({
          sourceAuras: new Set([Spells.MasterDemonologistR5]),
        }),
      )

      expect(result.value).toBe(1 - Mods.MasterDemonologist * 5)
    })
  })

  describe('abilities', () => {
    it('calculates Searing Pain with 2x threat', () => {
      const formula = warlockConfig.abilities[Spells.SearingPainR1]
      expect(formula).toBeDefined()

      const result = formula!(
        createMockContext({
          event: createDamageEvent(),
          amount: 200,
        }),
      )

      expect(result?.spellModifier).toEqual({
        type: 'spell',
        value: 2,
      })
      expect(result?.value).toBe(400)
    })

    it('applies Curse of Doom threat on debuff and damage ticks', () => {
      const formula = warlockConfig.abilities[Spells.CurseOfDoom]
      expect(formula).toBeDefined()

      const debuffResult = formula!(
        createMockContext({
          event: createApplyDebuffEvent(),
          amount: 0,
        }),
      )
      const damageResult = formula!(
        createMockContext({
          event: createDamageEvent(),
          amount: 456,
        }),
      )

      expect(debuffResult?.spellModifier).toEqual({
        type: 'spell',
        value: 0,
        bonus: 120,
      })
      expect(debuffResult?.value).toBe(120)
      expect(damageResult?.spellModifier).toBeUndefined()
      expect(damageResult?.value).toBe(456)
    })

    it('applies Siphon Life threat on debuff and damage ticks', () => {
      const formula = warlockConfig.abilities[Spells.SiphonLifeR1]
      expect(formula).toBeDefined()

      const debuffResult = formula!(
        createMockContext({
          event: createApplyDebuffEvent(),
          amount: 0,
        }),
      )
      const damageResult = formula!(
        createMockContext({
          event: createDamageEvent(),
          amount: 222,
        }),
      )

      expect(debuffResult?.spellModifier).toEqual({
        type: 'spell',
        value: 0,
        bonus: 60,
      })
      expect(debuffResult?.value).toBe(60)
      expect(damageResult?.spellModifier).toBeUndefined()
      expect(damageResult?.value).toBe(222)
    })
  })
})
