/**
 * Tests for the WoW Forever Druid threat configuration.
 */
import { processEvents } from '@wow-threat/engine'
import {
  type Actor,
  type Enemy,
  SpellSchool,
  createApplyDebuffEvent,
  createCastEvent,
  createCombatantInfoEvent,
  createDamageEvent,
  createHealEvent,
  createMockActorContext,
} from '@wow-threat/shared'
import type { ThreatCalculation, ThreatContext } from '@wow-threat/shared'
import { describe, expect, it } from 'vitest'

import {
  Spells as EraSpells,
  druidConfig as eraDruidConfig,
} from '../../era/classes/druid'
import { foreverConfig } from '../index'
import { ForeverTalentEntries, Spells, foreverDruidConfig } from './druid'

const druidActor: Actor = { id: 1, name: 'TestDruid', class: 'druid' }
const enemy: Enemy = { id: 2, name: 'TestEnemy', instance: 0 }

function assertDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined()
  if (value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: createDamageEvent({
      sourceID: druidActor.id,
      targetID: enemy.id,
    }),
    amount: 100,
    spellSchoolMask: SpellSchool.Physical,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: druidActor,
    targetActor: { id: enemy.id, name: enemy.name, class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...overrides,
  }
}

function runDamageWithTalent({
  abilityGameID,
  school,
  talentRank,
  auras = [],
}: {
  abilityGameID: number
  school: SpellSchool
  talentRank?: number
  auras?: number[]
}): ThreatCalculation | undefined {
  const talentTree =
    talentRank === undefined
      ? []
      : [
          {
            nodeID: 104920,
            id: ForeverTalentEntries.Subtlety,
            rank: talentRank,
          },
        ]
  const result = processEvents({
    rawEvents: [
      createCombatantInfoEvent({
        sourceID: druidActor.id,
        targetID: druidActor.id,
        auras: auras.map((ability) => ({
          source: druidActor.id,
          ability,
          stacks: 1,
          icon: 'spell_nature_forceofnature.jpg',
        })),
        talentTree,
      }),
      createDamageEvent({
        sourceID: druidActor.id,
        targetID: enemy.id,
        abilityGameID,
        amount: 100,
      }),
    ],
    actorMap: new Map([[druidActor.id, druidActor]]),
    enemies: [enemy],
    config: foreverConfig,
    abilitySchoolMap: new Map([[abilityGameID, school]]),
  })
  const damageEvent = result.augmentedEvents.find(
    (event) => event.type === 'damage',
  )

  return damageEvent?.threat?.calculation
}

describe('WoW Forever Druid config', () => {
  describe('Bear and Cat threat modifiers', () => {
    it('keeps the Era Bear Form modifier without Feral Instinct threat', () => {
      const bearModifier =
        foreverDruidConfig.auraModifiers[Spells.BearForm]!(createMockContext())

      expect(bearModifier.value).toBe(1.3)
      expect(
        foreverDruidConfig.auraModifiers[Spells.FeralInstinctRank1],
      ).toBeUndefined()
      expect(
        foreverDruidConfig.auraModifiers[Spells.FeralInstinctRank5],
      ).toBeUndefined()
    })

    it('leaves the Classic Feral Instinct Bear threat modifier intact', () => {
      const modifier = eraDruidConfig.auraModifiers[
        EraSpells.FeralInstinctRank5
      ]!(
        createMockContext({
          sourceAuras: new Set([EraSpells.BearForm]),
        }),
      )

      expect(modifier.value).toBeCloseTo((1.3 + 0.15) / 1.3)
    })

    it('keeps the Era Cat Form modifier', () => {
      const catModifier =
        foreverDruidConfig.auraModifiers[Spells.CatForm]!(createMockContext())

      expect(catModifier.value).toBe(0.71)
    })
  })

  describe('Bear abilities', () => {
    it('uses 3.5x logged damage for every Swipe rank', () => {
      const swipeRanks = [
        Spells.SwipeR1,
        Spells.SwipeR2,
        Spells.SwipeR3,
        Spells.SwipeR4,
        Spells.SwipeR5,
      ]

      swipeRanks.forEach((spellId) => {
        const result = assertDefined(
          foreverDruidConfig.abilities[spellId]!(createMockContext()),
        )

        expect(result.value).toBe(350)
        expect(result.spellModifier).toEqual({
          type: 'spell',
          value: 3.5,
        })
      })
    })

    it('keeps Maul at 1.75x logged damage', () => {
      const result = assertDefined(
        foreverDruidConfig.abilities[Spells.MaulR1]!(createMockContext()),
      )

      expect(result.value).toBe(175)
      expect(result.spellModifier).toEqual({
        type: 'spell',
        value: 1.75,
      })
    })

    it.each([
      [Spells.CowerR1, -480],
      [Spells.CowerR2, -780],
      [Spells.CowerR3, -1200],
    ])('uses doubled Cower reduction for spell %i', (spellId, reduction) => {
      const result = assertDefined(
        foreverDruidConfig.abilities[spellId]!(
          createMockContext({ event: createCastEvent() }),
        ),
      )

      expect(result.value).toBe(reduction)
      expect(result.spellModifier).toEqual({
        type: 'spell',
        bonus: reduction,
      })
    })

    it('recognizes every Primal Bite rank without inventing bonus threat', () => {
      const primalBiteRanks = [
        Spells.PrimalBiteR1,
        Spells.PrimalBiteR2,
        Spells.PrimalBiteR3,
        Spells.PrimalBiteR4,
      ]

      primalBiteRanks.forEach((spellId) => {
        const result = assertDefined(
          foreverDruidConfig.abilities[spellId]!(createMockContext()),
        )

        expect(result.value).toBe(100)
        expect(result.note).toContain('server-side bonus threat unresolved')
      })
    })

    it('recognizes every Lacerate rank without importing SoD/TBC threat', () => {
      const lacerateRanks = [
        Spells.LacerateR1,
        Spells.LacerateR2,
        Spells.LacerateR3,
      ]

      lacerateRanks.forEach((spellId) => {
        const result = assertDefined(
          foreverDruidConfig.abilities[spellId]!(createMockContext()),
        )

        expect(result.value).toBe(100)
        expect(result.note).toContain('server-side bonus threat unresolved')
      })
    })

    it('uses Primal Bite and Lacerate to infer Dire Bear Form', () => {
      const bearAbilities = foreverDruidConfig.auraImplications?.get(
        Spells.DireBearForm,
      )

      expect(bearAbilities).toBeDefined()
      expect(bearAbilities?.has(Spells.PrimalBiteR1)).toBe(true)
      expect(bearAbilities?.has(Spells.PrimalBiteR4)).toBe(true)
      expect(bearAbilities?.has(Spells.LacerateR1)).toBe(true)
      expect(bearAbilities?.has(Spells.LacerateR3)).toBe(true)
    })
  })

  describe('Subtlety', () => {
    it.each([
      [0, 1],
      [1, 0.9],
      [2, 0.8],
      [3, 0.7],
    ])('maps rank %i to a %f Nature/Arcane modifier', (rank, value) => {
      const talent =
        foreverDruidConfig.talentModifiers![ForeverTalentEntries.Subtlety]!
      const modifier = talent.modifier(createMockContext(), rank)

      expect(talent.spellId).toBe(Spells.Subtlety)
      expect(talent.maxRank).toBe(3)
      expect(modifier.value).toBeCloseTo(value)
      expect(modifier.schoolMask).toBe(SpellSchool.Nature | SpellSchool.Arcane)
    })

    it.each([SpellSchool.Nature, SpellSchool.Arcane])(
      'applies rank 3 to school mask %i',
      (school) => {
        const calculation = assertDefined(
          runDamageWithTalent({
            abilityGameID: 500001 + school,
            school,
            talentRank: 3,
          }),
        )

        expect(calculation.modifiedThreat).toBeCloseTo(70)
      },
    )

    it('applies to Nature healing through the normal healing pipeline', () => {
      const result = processEvents({
        rawEvents: [
          createCombatantInfoEvent({
            sourceID: druidActor.id,
            targetID: druidActor.id,
            auras: [],
            talentTree: [
              {
                nodeID: 104920,
                id: ForeverTalentEntries.Subtlety,
                rank: 3,
              },
            ],
          }),
          createHealEvent({
            sourceID: druidActor.id,
            targetID: druidActor.id,
            abilityGameID: Spells.TranquilityR1,
            amount: 100,
          }),
        ],
        actorMap: new Map([[druidActor.id, druidActor]]),
        enemies: [enemy],
        config: foreverConfig,
        abilitySchoolMap: new Map([[Spells.TranquilityR1, SpellSchool.Nature]]),
      })
      const healing = result.augmentedEvents.find(
        (event) => event.type === 'heal',
      )

      expect(healing?.threat?.calculation.baseThreat).toBe(50)
      expect(healing?.threat?.calculation.modifiedThreat).toBeCloseTo(35)
    })

    it('does not reduce physical Cat or Bear attacks', () => {
      const calculation = assertDefined(
        runDamageWithTalent({
          abilityGameID: Spells.Claw,
          school: SpellSchool.Physical,
          talentRank: 3,
        }),
      )

      expect(calculation.modifiedThreat).toBe(100)
      expect(calculation.modifiers).not.toContainEqual(
        expect.objectContaining({ sourceId: Spells.Subtlety }),
      )
    })

    it('does not stack a SoD-style Moonkin threat reduction', () => {
      const calculation = assertDefined(
        runDamageWithTalent({
          abilityGameID: 500100,
          school: SpellSchool.Nature,
          talentRank: 3,
          auras: [Spells.MoonkinForm],
        }),
      )

      expect(
        foreverDruidConfig.auraModifiers[Spells.MoonkinForm],
      ).toBeUndefined()
      expect(calculation.modifiedThreat).toBeCloseTo(70)
      expect(calculation.modifiers).toHaveLength(1)
      expect(calculation.modifiers[0]).toEqual(
        expect.objectContaining({ sourceId: Spells.Subtlety, value: 0.7 }),
      )
    })
  })

  describe('preserved Era mechanics', () => {
    it.each([
      [1, 0.5],
      [2, 0],
    ])('maps Improved Tranquility rank %i to %f threat', (rank, value) => {
      const talent =
        foreverDruidConfig.talentModifiers![
          ForeverTalentEntries.ImprovedTranquility
        ]!
      const modifier = talent.modifier(createMockContext(), rank)

      expect(talent.spellId).toBe(Spells.ImprovedTranquility)
      expect(talent.maxRank).toBe(2)
      expect(modifier.value).toBe(value)
      expect(modifier.spellIds).toEqual(
        new Set([
          Spells.TranquilityR1,
          Spells.TranquilityR2,
          Spells.TranquilityR3,
          Spells.TranquilityR4,
        ]),
      )
    })

    it('keeps Faerie Fire at +108 flat threat', () => {
      const result = assertDefined(
        foreverDruidConfig.abilities[Spells.FaerieFireR1]!(
          createMockContext({ event: createApplyDebuffEvent() }),
        ),
      )

      expect(result.value).toBe(108)
      expect(result.spellModifier).toEqual({
        type: 'spell',
        bonus: 108,
      })
    })

    it('keeps Growl threat-copy behavior', () => {
      const result = assertDefined(
        foreverDruidConfig.abilities[Spells.Growl]!(
          createMockContext({
            event: createApplyDebuffEvent(),
            actors: createMockActorContext({
              getThreat: () => 100,
              getTopActorsByThreat: () => [{ actorId: 99, threat: 500 }],
              isActorAlive: () => true,
            }),
          }),
        ),
      )

      expect(result.effects).toEqual([
        {
          type: 'customThreat',
          changes: [
            {
              sourceId: druidActor.id,
              targetId: enemy.id,
              targetInstance: 0,
              operator: 'set',
              amount: 500,
            },
          ],
        },
      ])
    })

    it('keeps Challenging Roar as a fixate without permanent threat', () => {
      const result = foreverDruidConfig.abilities[Spells.ChallengingRoar]!(
        createMockContext({ event: createApplyDebuffEvent() }),
      )

      expect(result).toBeUndefined()
      expect(foreverDruidConfig.fixateBuffs?.has(Spells.ChallengingRoar)).toBe(
        true,
      )
    })
  })

  describe('Cenarion Rage 6-piece', () => {
    it('adds 20% Bear threat through an isolated gear modifier', () => {
      const modifier = foreverDruidConfig.auraModifiers[
        Spells.CenarionRage6Piece
      ]!(
        createMockContext({
          sourceAuras: new Set([Spells.BearForm, Spells.CenarionRage6Piece]),
        }),
      )

      expect(modifier.value).toBe(1.2)
      expect(modifier.source).toBe('gear')
    })

    it('changes Cower from flat reduction to a target threat wipe', () => {
      const result = assertDefined(
        foreverDruidConfig.abilities[Spells.CowerR3]!(
          createMockContext({
            event: createCastEvent(),
            sourceAuras: new Set([Spells.CenarionRage6Piece]),
          }),
        ),
      )

      expect(result.value).toBe(0)
      expect(result.note).toBe('Cenarion Rage 6-piece Cower threat wipe')
      expect(result.effects).toEqual([
        {
          type: 'customThreat',
          changes: [
            {
              sourceId: druidActor.id,
              targetId: enemy.id,
              targetInstance: 0,
              operator: 'set',
              amount: 0,
            },
          ],
        },
      ])
    })
  })
})
