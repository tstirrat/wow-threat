/**
 * Tests for Priest Threat Configuration
 */
import { processEvents } from '@wow-threat/engine'
import {
  type Actor,
  type Enemy,
  createCombatantInfoEvent,
  createDamageEvent,
  createHealEvent,
  createMockActorContext,
} from '@wow-threat/shared'
import type {
  TalentImplicationContext,
  ThreatContext,
} from '@wow-threat/shared/src/types'
import { SpellSchool } from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { eraConfig } from '../index'
import { SetIds, Spells, VestmentsHealSpellIds, priestConfig } from './priest'

const priest: Actor = { id: 1, name: 'TestPriest', class: 'priest' }
const friendly: Actor = { id: 3, name: 'Friendly', class: 'warrior' }
const enemy: Enemy = { id: 2, name: 'TestEnemy', instance: 0 }

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

function processHealWithVestmentsPieces(
  pieceCount: number,
  abilityGameID: number = Spells.FlashHealR1,
) {
  return processEvents({
    rawEvents: [
      createCombatantInfoEvent({
        sourceID: priest.id,
        targetID: priest.id,
        auras: [],
        gear: Array.from({ length: pieceCount }, (_, id) => ({
          id,
          setID: SetIds.VestmentsOfFaith,
        })),
      }),
      createHealEvent({
        sourceID: priest.id,
        targetID: friendly.id,
        abilityGameID,
        amount: 100,
      }),
    ],
    actorMap: new Map([
      [priest.id, priest],
      [friendly.id, friendly],
    ]),
    enemies: [enemy],
    config: eraConfig,
  }).augmentedEvents.find((event) => event.type === 'heal')
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

    it('applies the Vestments 10% reduction only to affected healing spells', () => {
      const modifier =
        priestConfig.auraModifiers[Spells.VestmentsReducedThreat]!(
          createMockContext(),
        )

      expect(modifier).toEqual({
        source: 'gear',
        name: 'Vestments of Faith (6-piece)',
        value: 0.9,
        spellIds: VestmentsHealSpellIds,
      })
      expect(modifier.spellIds).toContain(Spells.LesserHealR1)
      expect(modifier.spellIds).toContain(Spells.GreaterHealR5)
      expect(modifier.spellIds).toContain(Spells.FlashHealR7)
      expect(modifier.spellIds).toContain(Spells.RenewR10)
      expect(modifier.spellIds).toContain(Spells.PrayerOfHealingR5)
      expect(modifier.spellIds).toContain(Spells.DesperatePrayerR7)
      expect(modifier.spellIds).toContain(Spells.HolyNovaHealR6)
    })
  })

  describe('Vestments of Faith', () => {
    it('infers Reduced Threat only at six equipped pieces', () => {
      const fivePieces = Array.from({ length: 5 }, (_, id) => ({
        id,
        setID: SetIds.VestmentsOfFaith,
      }))
      const sixPieces = [
        ...fivePieces,
        { id: 6, setID: SetIds.VestmentsOfFaith },
      ]

      expect(priestConfig.gearImplications!(fivePieces)).toEqual([])
      expect(priestConfig.gearImplications!(sixPieces)).toEqual([
        Spells.VestmentsReducedThreat,
      ])
    })

    it('reduces affected healing threat by 10% through the engine', () => {
      expect(
        processHealWithVestmentsPieces(5)?.threat?.calculation.modifiedThreat,
      ).toBe(50)
      expect(
        processHealWithVestmentsPieces(6)?.threat?.calculation.modifiedThreat,
      ).toBe(45)
    })

    it('does not reduce healing from spells outside the affected list', () => {
      expect(
        processHealWithVestmentsPieces(6, 999999)?.threat?.calculation
          .modifiedThreat,
      ).toBe(50)
    })

    it('keeps Holy Nova at zero threat with the set active', () => {
      const event = processHealWithVestmentsPieces(6, Spells.HolyNovaHealR6)

      expect(event?.threat).toBeUndefined()
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
