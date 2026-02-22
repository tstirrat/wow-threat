/**
 * Threat Engine Tests
 *
 * Unit tests for the threat engine that processes raw WCL events and calculates
 * threat. Uses mock configs to test behaviors surgically without dependencies on
 * real config evolution.
 */
import {
  createAbsorbedEvent,
  createApplyBuffEvent,
  createApplyBuffStackEvent,
  createApplyDebuffEvent,
  createApplyDebuffStackEvent,
  createBeginCastEvent,
  createCastEvent,
  createCombatantInfoAura,
  createDamageEvent,
  createEnergizeEvent,
  createHealEvent,
  createMockActorContext,
  createRefreshBuffEvent,
  createRemoveBuffEvent,
  createRemoveBuffStackEvent,
  createRemoveDebuffEvent,
  createResourceChangeEvent,
} from '@wow-threat/shared'
import {
  type Actor,
  type EncounterId,
  type Enemy,
  type EventInterceptor,
  SpellSchool,
  type ThreatConfig,
  type ThreatContext,
  type ThreatModifier,
} from '@wow-threat/shared'
import {
  type AbsorbedEvent,
  type DamageEvent,
  type GearItem,
  ResourceTypeCode,
  type WCLEvent,
} from '@wow-threat/wcl-types'
import { describe, expect, it, vi } from 'vitest'

import { createMockThreatConfig } from './test/helpers/config'
import {
  calculateModifiedThreat,
  calculateThreatModification,
  processEvents,
} from './threat-engine'

// Test fixtures
const warriorActor: Actor = { id: 1, name: 'WarriorTank', class: 'warrior' }
const priestActor: Actor = { id: 2, name: 'PriestHealer', class: 'priest' }
const druidActor: Actor = { id: 3, name: 'Druid', class: 'druid' }

const bossEnemy: Enemy = { id: 99, name: 'Boss', instance: 0 }
const addEnemy: Enemy = { id: 100, name: 'Add', instance: 0 }

const enemies: Enemy[] = [bossEnemy, addEnemy]

// Spell IDs for testing
const SPELLS = {
  // Stances
  DEFENSIVE_STANCE: 71,
  BATTLE_STANCE: 2457,
  BERSERKER_STANCE: 2458,
  BEAR_FORM: 5487,
  CAT_FORM: 768,
  // Abilities
  MOCK_ABILITY_1: 1001,
  MOCK_ABILITY_2: 1002,
  MOCK_CAST_CAN_MISS: 1003,
  MOCK_CAST_CAN_MISS_NO_COEFF: 1004,
  RAKE: 9904,
  // Auras
  MOCK_AURA_THREAT_UP: 2001,
  MOCK_AURA_THREAT_DOWN: 2002,
  // Set bonus
  SET_BONUS_AURA: 3001,
  MOCK_DEFIANCE_RANK_5_AURA: 3002,
} as const

/**
 * Create mock config with custom base threat formulas and warrior/priest configs
 */
const mockConfig = createMockThreatConfig({
  baseThreat: {
    damage: (ctx: ThreatContext) => ({
      formula: '(base) 2 * damage',
      value: ctx.amount * 2,
      splitAmongEnemies: false,
    }),
    absorbed: (ctx: ThreatContext) => ({
      formula: '(base) absorbAmount',
      value: ctx.amount,
      splitAmongEnemies: false,
    }),
    heal: (ctx: ThreatContext) => ({
      formula: '(base) 0.5 * heal',
      value: ctx.amount * 0.5,
      splitAmongEnemies: true,
    }),
    energize: (ctx: ThreatContext) => ({
      formula: '(base) 0.5 * resourceChange',
      value: ctx.amount * 0.5,
      splitAmongEnemies: false,
    }),
  },

  classes: {
    warrior: {
      exclusiveAuras: [
        new Set([
          SPELLS.DEFENSIVE_STANCE,
          SPELLS.BATTLE_STANCE,
          SPELLS.BERSERKER_STANCE,
        ]),
      ],
      baseThreatFactor: 1.3,

      auraModifiers: {
        // Defensive Stance: 1.3x threat
        [SPELLS.DEFENSIVE_STANCE]: () => ({
          source: 'stance',
          name: 'Defensive Stance',
          value: 1.3,
        }),

        // Mock threat up aura
        [SPELLS.MOCK_AURA_THREAT_UP]: () => ({
          source: 'buff',
          name: 'Test Threat Up',
          value: 1.5,
        }),

        // Mock threat down aura
        [SPELLS.MOCK_AURA_THREAT_DOWN]: () => ({
          source: 'debuff',
          name: 'Test Threat Down',
          value: 0.5,
        }),

        // Set bonus aura from gear implications
        [SPELLS.SET_BONUS_AURA]: () => ({
          source: 'gear',
          name: 'Set Bonus: 8pc Tier 1',
          value: 0.8,
        }),
        [SPELLS.MOCK_DEFIANCE_RANK_5_AURA]: () => ({
          source: 'talent',
          name: 'Defiance (Rank 5)',
          value: 1.15,
        }),
      },

      abilities: {
        // Mock ability with custom formula
        [SPELLS.MOCK_ABILITY_1]: (ctx: ThreatContext) => ({
          formula: '(custom) amt + 100',
          value: ctx.amount + 100,
          splitAmongEnemies: false,
        }),

        // Mock ability that splits threat
        [SPELLS.MOCK_ABILITY_2]: (ctx: ThreatContext) => ({
          formula: '0.5 * amt',
          value: ctx.amount * 0.5,
          splitAmongEnemies: true,
        }),
      },

      gearImplications: (gear: GearItem[]) => {
        // Simulate detecting set bonus from gear
        const hasSetItem = gear.some((item) => item.setID === 1)
        if (hasSetItem) {
          return [SPELLS.SET_BONUS_AURA]
        }
        return []
      },
      talentImplications: ({ talentPoints }) =>
        (talentPoints[2] ?? 0) >= 31 ? [SPELLS.MOCK_DEFIANCE_RANK_5_AURA] : [],

      fixateBuffs: new Set(),
      aggroLossBuffs: new Set(),
      invulnerabilityBuffs: new Set(),
    },

    priest: {
      baseThreatFactor: 1.0,
      auraModifiers: {
        // Mock aura for priest
        [SPELLS.MOCK_AURA_THREAT_UP]: () => ({
          source: 'buff',
          name: 'Test Threat Up',
          value: 1.5,
        }),
      },
      abilities: {},
    },

    druid: {
      exclusiveAuras: [new Set([SPELLS.BEAR_FORM, SPELLS.CAT_FORM])],
      baseThreatFactor: 1.0,
      auraImplications: new Map([[SPELLS.CAT_FORM, new Set([SPELLS.RAKE])]]),
      auraModifiers: {
        [SPELLS.CAT_FORM]: () => ({
          source: 'class',
          name: 'Cat Form',
          value: 0.71,
        }),
      },
      abilities: {},
    },
    // rogue from default is included
  },
})

describe('processEvents', () => {
  describe('event counting', () => {
    it('counts event types correctly', () => {
      const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

      const events: WCLEvent[] = [
        createDamageEvent({
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
        }),
        createDamageEvent({
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
        }),
        createHealEvent({
          sourceID: warriorActor.id,
          targetID: warriorActor.id,
        }),
        createApplyBuffEvent({
          targetID: warriorActor.id,
          abilityGameID: SPELLS.DEFENSIVE_STANCE,
        }),
        createRefreshBuffEvent({
          targetID: warriorActor.id,
          abilityGameID: SPELLS.DEFENSIVE_STANCE,
        }),
        createApplyDebuffStackEvent({
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          targetIsFriendly: false,
          abilityGameID: SPELLS.MOCK_AURA_THREAT_DOWN,
          stacks: 2,
        }),
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies,
        config: mockConfig,
      })

      expect(result.eventCounts.damage).toBe(2)
      expect(result.eventCounts.heal).toBe(1)
      expect(result.eventCounts.applybuff).toBe(1)
      expect(result.eventCounts.refreshbuff).toBe(1)
      expect(result.eventCounts.applydebuffstack).toBe(1)
    })
  })

  it('uses abilitySchoolMap for school-scoped modifiers', () => {
    const RIGHTEOUS_FURY = 25780
    const paladinActor: Actor = {
      id: 7,
      name: 'PaladinTank',
      class: 'paladin',
    }
    const actorMap = new Map<number, Actor>([[paladinActor.id, paladinActor]])
    const config = createMockThreatConfig({
      classes: {
        paladin: {
          baseThreatFactor: 1,
          auraModifiers: {
            [RIGHTEOUS_FURY]: () => ({
              source: 'stance',
              name: 'Righteous Fury',
              value: 1.6,
              schoolMask: SpellSchool.Holy,
            }),
          },
          abilities: {},
        },
      },
    })

    const events: WCLEvent[] = [
      createApplyBuffEvent({
        sourceID: paladinActor.id,
        targetID: paladinActor.id,
        sourceIsFriendly: true,
        targetIsFriendly: true,
        abilityGameID: RIGHTEOUS_FURY,
      }),
      createDamageEvent({
        sourceID: paladinActor.id,
        targetID: bossEnemy.id,
        targetIsFriendly: false,
        abilityGameID: SPELLS.MOCK_ABILITY_1,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      abilitySchoolMap: new Map([[SPELLS.MOCK_ABILITY_1, SpellSchool.Nature]]),
      enemies: [bossEnemy],
      config,
    })

    const damageEvent = result.augmentedEvents.find((event) => {
      return event.type === 'damage'
    })
    expect(
      damageEvent?.threat!.calculation.modifiers.find(
        (modifier) => modifier.name === 'Righteous Fury',
      ),
    ).toBeUndefined()
  })

  describe('encounter preprocessors', () => {
    it('applies a threat wipe special on first boss cast after long gaps', () => {
      const CAST_GAP_MS = 30000
      const encounterId = 1234 as EncounterId

      const createCastGapWipePreprocessor = () => {
        const lastCastBySource = new Map<number, number>()

        return (ctx: ThreatContext) => {
          const event = ctx.event

          if (event.type !== 'cast' || event.sourceIsFriendly) {
            return undefined
          }

          const previousCast = lastCastBySource.get(event.sourceID)
          lastCastBySource.set(event.sourceID, event.timestamp)

          if (
            previousCast === undefined ||
            event.timestamp - previousCast <= CAST_GAP_MS
          ) {
            return undefined
          }

          return {
            effects: [
              {
                type: 'modifyThreat' as const,
                multiplier: 0,
                target: 'all' as const,
              },
            ],
          }
        }
      }

      const config = createMockThreatConfig({
        encounters: {
          [encounterId]: {
            preprocessor: createCastGapWipePreprocessor,
          },
        },
      })

      const actorMap = new Map<number, Actor>([
        [warriorActor.id, warriorActor],
        [bossEnemy.id, { id: bossEnemy.id, name: 'Boss', class: null }],
      ])

      const events: WCLEvent[] = [
        createDamageEvent({
          timestamp: 1000,
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          amount: 100,
        }),
        {
          timestamp: 5000,
          type: 'cast',
          sourceID: bossEnemy.id,
          sourceIsFriendly: false,
          sourceInstance: 0,
          targetID: warriorActor.id,
          targetIsFriendly: true,
          abilityGameID: 9001,
        },
        {
          timestamp: 36050,
          type: 'cast',
          sourceID: bossEnemy.id,
          sourceIsFriendly: false,
          sourceInstance: 0,
          targetID: warriorActor.id,
          targetIsFriendly: true,
          abilityGameID: 9002,
        },
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies: [bossEnemy],
        encounterId,
        config,
      })

      expect(result.augmentedEvents).toHaveLength(3)
      expect(result.eventCounts.cast).toBe(2)

      const postGapCast = result.augmentedEvents[2]
      expect(postGapCast?.type).toBe('cast')
      expect(postGapCast?.abilityGameID).toBe(9002)
      expect(postGapCast?.threat!.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceId: warriorActor.id,
            targetId: bossEnemy.id,
            operator: 'set',
            total: 0,
          }),
        ]),
      )
    })
  })

  describe('death and alive state interactions', () => {
    it('excludes dead enemies from split threat', () => {
      const actorMap = new Map<number, Actor>([[priestActor.id, priestActor]])

      const deathEvent: WCLEvent = {
        timestamp: 1500,
        type: 'death',
        sourceID: priestActor.id,
        sourceIsFriendly: true,
        targetID: addEnemy.id,
        targetIsFriendly: false,
      }

      const events: WCLEvent[] = [
        createHealEvent({
          timestamp: 1000,
          sourceID: priestActor.id,
          targetID: priestActor.id,
          amount: 1000,
        }),
        deathEvent,
        createHealEvent({
          timestamp: 2000,
          sourceID: priestActor.id,
          targetID: priestActor.id,
          amount: 1000,
        }),
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies,
        config: mockConfig,
      })

      const firstHeal = result.augmentedEvents[0]
      expect(firstHeal?.threat!.changes).toHaveLength(2)

      const secondHeal = result.augmentedEvents[2]
      expect(secondHeal?.threat!.changes).toHaveLength(1)
      expect(secondHeal?.threat!.changes?.[0]).toMatchObject({
        sourceId: priestActor.id,
        targetId: bossEnemy.id,
        operator: 'add',
        amount: 500,
      })
    })

    it('wipes player threat on death using set operations to zero', () => {
      const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

      const deathEvent: WCLEvent = {
        timestamp: 3000,
        type: 'death',
        sourceID: bossEnemy.id,
        sourceIsFriendly: false,
        targetID: warriorActor.id,
        targetIsFriendly: true,
      }

      const events: WCLEvent[] = [
        createDamageEvent({
          timestamp: 1000,
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          amount: 400,
        }),
        createDamageEvent({
          timestamp: 2000,
          sourceID: warriorActor.id,
          targetID: addEnemy.id,
          amount: 200,
        }),
        deathEvent,
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies,
        config: mockConfig,
      })

      const deathAugmented = result.augmentedEvents[2]
      const deathChanges = deathAugmented?.threat!.changes ?? []

      expect(deathChanges).toHaveLength(2)
      expect(deathAugmented?.threat?.calculation.effects).toEqual(
        expect.arrayContaining([
          {
            type: 'eventMarker',
            marker: 'death',
          },
        ]),
      )
      expect(deathChanges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceId: warriorActor.id,
            targetId: bossEnemy.id,
            operator: 'set',
            amount: 0,
            total: 0,
          }),
          expect.objectContaining({
            sourceId: warriorActor.id,
            targetId: addEnemy.id,
            operator: 'set',
            amount: 0,
            total: 0,
          }),
        ]),
      )
    })

    it('keeps dead players at zero threat until cast activity marks them alive', () => {
      const actorMap = new Map<number, Actor>([
        [warriorActor.id, warriorActor],
        [bossEnemy.id, { id: bossEnemy.id, name: 'Boss', class: null }],
      ])

      const deathEvent: WCLEvent = {
        timestamp: 1500,
        type: 'death',
        sourceID: bossEnemy.id,
        sourceIsFriendly: false,
        targetID: warriorActor.id,
        targetIsFriendly: true,
      }

      const events: WCLEvent[] = [
        createDamageEvent({
          timestamp: 1000,
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          amount: 100,
        }),
        deathEvent,
        createDamageEvent({
          timestamp: 2000,
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          amount: 100,
          tick: true,
        }),
        createCastEvent({
          timestamp: 2500,
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          abilityGameID: SPELLS.MOCK_ABILITY_1,
        }),
        createDamageEvent({
          timestamp: 3000,
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          amount: 100,
        }),
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies,
        config: mockConfig,
      })

      const deathChanges = result.augmentedEvents[1]?.threat?.changes ?? []
      expect(deathChanges).toEqual([
        expect.objectContaining({
          sourceId: warriorActor.id,
          targetId: bossEnemy.id,
          operator: 'set',
          total: 0,
        }),
      ])

      const deadDotTick = result.augmentedEvents[2]
      expect(deadDotTick?.threat?.changes).toBeUndefined()

      const castThreatTotal =
        result.augmentedEvents[3]?.threat?.changes?.[0]?.total
      const postCastDamage = result.augmentedEvents[4]
      const postCastDamageChange = postCastDamage?.threat?.changes?.[0]
      expect(postCastDamageChange).toBeDefined()
      expect(postCastDamageChange).toMatchObject({
        sourceId: warriorActor.id,
        targetId: bossEnemy.id,
        operator: 'add',
      })
      expect(postCastDamageChange?.amount ?? 0).toBeGreaterThan(0)
      expect(postCastDamageChange?.total).toBe(
        (castThreatTotal ?? 0) + (postCastDamageChange?.amount ?? 0),
      )
    })

    it('keeps dead players at zero threat until begincast activity marks them alive', () => {
      const actorMap = new Map<number, Actor>([
        [warriorActor.id, warriorActor],
        [bossEnemy.id, { id: bossEnemy.id, name: 'Boss', class: null }],
      ])

      const events: WCLEvent[] = [
        createDamageEvent({
          timestamp: 1000,
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          amount: 100,
        }),
        {
          timestamp: 1500,
          type: 'death',
          sourceID: bossEnemy.id,
          sourceIsFriendly: false,
          targetID: warriorActor.id,
          targetIsFriendly: true,
        },
        createDamageEvent({
          timestamp: 2000,
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          amount: 100,
          tick: true,
        }),
        createBeginCastEvent({
          timestamp: 2500,
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          abilityGameID: SPELLS.MOCK_ABILITY_1,
        }),
        createDamageEvent({
          timestamp: 3000,
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          amount: 100,
        }),
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies,
        config: mockConfig,
      })

      const deadDotTick = result.augmentedEvents[2]
      expect(deadDotTick?.threat?.changes).toBeUndefined()

      const beginCastEvent = result.augmentedEvents[3]
      expect(beginCastEvent?.type).toBe('begincast')
      const beginCastThreatTotal = beginCastEvent?.threat?.changes?.[0]?.total

      const postBeginCastDamage = result.augmentedEvents[4]
      const postBeginCastDamageChange =
        postBeginCastDamage?.threat?.changes?.[0]
      expect(postBeginCastDamageChange).toBeDefined()
      expect(postBeginCastDamageChange).toMatchObject({
        sourceId: warriorActor.id,
        targetId: bossEnemy.id,
        operator: 'add',
      })
      expect(postBeginCastDamageChange?.amount ?? 0).toBeGreaterThan(0)
      expect(postBeginCastDamageChange?.total).toBe(
        (beginCastThreatTotal ?? 0) + (postBeginCastDamageChange?.amount ?? 0),
      )
    })

    it('wipes player threat per enemy instance on death', () => {
      const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])
      const instanceOneEnemy: Enemy = {
        id: bossEnemy.id,
        name: 'Boss',
        instance: 1,
      }
      const instanceTwoEnemy: Enemy = {
        id: bossEnemy.id,
        name: 'Boss',
        instance: 2,
      }

      const deathEvent: WCLEvent = {
        timestamp: 3000,
        type: 'death',
        sourceID: bossEnemy.id,
        sourceIsFriendly: false,
        targetID: warriorActor.id,
        targetIsFriendly: true,
      }

      const events: WCLEvent[] = [
        createDamageEvent({
          timestamp: 1000,
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          targetInstance: 1,
          amount: 400,
        }),
        createDamageEvent({
          timestamp: 2000,
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          targetInstance: 2,
          amount: 200,
        }),
        deathEvent,
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies: [instanceOneEnemy, instanceTwoEnemy],
        config: mockConfig,
      })

      const deathChanges = result.augmentedEvents[2]?.threat!.changes ?? []
      expect(deathChanges).toHaveLength(2)
      expect(deathChanges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceId: warriorActor.id,
            targetId: bossEnemy.id,
            targetInstance: 1,
            operator: 'set',
            total: 0,
          }),
          expect.objectContaining({
            sourceId: warriorActor.id,
            targetId: bossEnemy.id,
            targetInstance: 2,
            operator: 'set',
            total: 0,
          }),
        ]),
      )
    })
  })
})

// ============================================================================
// calculateModifiedThreat Tests
// ============================================================================

describe('calculateModifiedThreat', () => {
  // Test-Specific Constants
  const SPELLS = {
    DEFENSIVE_STANCE: 71,
    DEFIANCE_RANK_5: 12305,
    BEAR_FORM: 5487,
    RIGHTEOUS_FURY: 25780,
    SEAL_OF_RIGHTEOUSNESS: 25742,
    BLESSING_OF_SALVATION: 25846,
    GREATER_BLESSING_OF_SALVATION: 25895,
    FETISH_OF_THE_SAND_REAVER: 26400,
  } as const

  // Test Helpers
  const defaultActor: Actor = { id: 1, name: 'TestPlayer', class: 'warrior' }
  const defaultEnemy: Enemy = { id: 99, name: 'TestBoss', instance: 0 }

  interface TestCallOptions {
    sourceAuras?: Set<number>
    targetAuras?: Set<number>
    spellSchoolMask?: number
    enemies?: Enemy[]
    sourceActor?: Actor
    targetActor?: Actor
    encounterId?: number | null
  }

  /**
   * Helper to create standardized test options with mocked actor context
   */
  function createTestOptions(overrides: TestCallOptions = {}) {
    return {
      sourceAuras: overrides.sourceAuras ?? new Set(),
      targetAuras: overrides.targetAuras ?? new Set(),
      spellSchoolMask: overrides.spellSchoolMask ?? 0,
      enemies: overrides.enemies ?? [defaultEnemy],
      sourceActor: overrides.sourceActor ?? defaultActor,
      targetActor: overrides.targetActor ?? {
        id: 99,
        name: 'Boss',
        class: null,
      },
      encounterId: (overrides.encounterId as EncounterId) ?? null,
      actors: createMockActorContext(),
    }
  }

  const mockThreatConfig: ThreatConfig = createMockThreatConfig({
    classes: {
      warrior: {
        baseThreatFactor: 1.0,
        auraModifiers: {
          [SPELLS.DEFENSIVE_STANCE]: () => ({
            source: 'stance',
            name: 'Defensive Stance',
            value: 1.3,
          }),
          [SPELLS.DEFIANCE_RANK_5]: () => ({
            source: 'talent',
            name: 'Defiance (Rank 5)',
            value: 1.15,
          }),
        },
        abilities: {},
      },
      // rogue automatically included from default
      druid: {
        baseThreatFactor: 1.0,
        auraModifiers: {
          [SPELLS.BEAR_FORM]: () => ({
            source: 'stance',
            name: 'Bear Form',
            value: 1.3,
          }),
        },
        abilities: {},
      },
      paladin: {
        baseThreatFactor: 1.0,
        auraModifiers: {
          [SPELLS.RIGHTEOUS_FURY]: () => ({
            source: 'stance',
            name: 'Righteous Fury',
            value: 1.6,
            schoolMask: SpellSchool.Holy,
          }),
        },
        abilities: {},
      },
      mage: {
        baseThreatFactor: 1.0,
        auraModifiers: {},
        abilities: {},
      },
      priest: {
        baseThreatFactor: 1.0,
        auraModifiers: {},
        abilities: {},
      },
    },
    auraModifiers: {
      [SPELLS.BLESSING_OF_SALVATION]: () => ({
        source: 'aura',
        name: 'Blessing of Salvation',
        value: 0.7,
      }),
      [SPELLS.GREATER_BLESSING_OF_SALVATION]: () => ({
        source: 'aura',
        name: 'Greater Blessing of Salvation',
        value: 0.7,
      }),
      [SPELLS.FETISH_OF_THE_SAND_REAVER]: () => ({
        source: 'aura',
        name: 'Fetish of the Sand Reaver',
        value: 0.3,
      }),
    },
  })

  describe('damage events', () => {
    it('calculates basic damage threat', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateModifiedThreat(
        event,
        createTestOptions(),
        mockThreatConfig,
      )

      expect(result.baseThreat).toBe(1000)
      expect(result.modifiedThreat).toBe(1000)
    })

    it('applies Defensive Stance modifier', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          sourceAuras: new Set([SPELLS.DEFENSIVE_STANCE]),
        }),
        mockThreatConfig,
      )

      expect(result.modifiers).toContainEqual(
        expect.objectContaining({ name: 'Defensive Stance', value: 1.3 }),
      )
      expect(result.modifiedThreat).toBe(1300) // 1000 * 1.3
    })

    it('applies multiple modifiers multiplicatively', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          // Defensive Stance (1.3) + Defiance Rank 5 (1.15)
          sourceAuras: new Set([
            SPELLS.DEFENSIVE_STANCE,
            SPELLS.DEFIANCE_RANK_5,
          ]),
        }),
        mockThreatConfig,
      )

      expect(result.modifiers).toHaveLength(2)
      // 1000 * 1.3 * 1.15 = 1495
      expect(result.modifiedThreat).toBeCloseTo(1495, 0)
    })

    it('applies base threat factor (Rogue)', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          sourceActor: { id: 1, name: 'RoguePlayer', class: 'rogue' },
        }),
        mockThreatConfig,
      )

      // Modifiers should contain the base modifier named "Rogue"
      expect(result.modifiers).toContainEqual(
        expect.objectContaining({ name: 'Rogue', value: 0.71 }),
      )
      // 1000 * 0.71 = 710
      expect(result.modifiedThreat).toBe(710)
    })

    it('does not apply base threat factor for standard classes (Warrior)', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
        }),
        mockThreatConfig,
      )

      // Should verify that NO modifier with source 'class' or name 'Warrior' exists
      const baseModifiers = result.modifiers.filter((m) => m.source === 'class')
      expect(baseModifiers).toHaveLength(0)

      // Should be 1000 flat
      expect(result.modifiedThreat).toBe(1000)
    })
  })

  describe('healing events', () => {
    it('calculates healing threat split among enemies', () => {
      const event = createHealEvent({
        amount: 4000,
        overheal: 500,
      })

      const enemies = [
        { id: 99, name: 'Boss', instance: 0 },
        { id: 26, name: 'Add', instance: 0 },
      ]

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          enemies,
          sourceActor: { id: 2, name: 'Healer', class: 'priest' },
          targetActor: defaultActor,
        }),
        mockThreatConfig,
      )

      // Effective heal: 3500, base threat: 1750, split 2 ways: 875 each
      expect(result.baseThreat).toBe(1750)
      expect(result.isSplit).toBe(true)
    })
  })

  describe('energize events', () => {
    it('calculates threat from resource generation', () => {
      const event = createEnergizeEvent({ resourceChange: 30 })

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          sourceActor: defaultActor,
          targetActor: defaultActor,
        }),
        mockThreatConfig,
      )

      // Energize events generate threat: rage * 5
      expect(result.amount).toBe(30)
      expect(result.baseThreat).toBe(150) // 30 * 5
    })

    it('splits threat among all enemies', () => {
      const event = createEnergizeEvent({ resourceChange: 40 })

      const enemies = [
        { id: 99, name: 'Boss', instance: 0 },
        { id: 26, name: 'Add', instance: 0 },
      ]

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          enemies,
          sourceActor: defaultActor,
          targetActor: defaultActor,
        }),
        mockThreatConfig,
      )

      // 40 rage * 5 = 200 base threat, split 2 ways = 100 each
      expect(result.baseThreat).toBe(200)
      expect(result.isSplit).toBe(true)
    })

    it('subtracts waste from resource change', () => {
      const event = createEnergizeEvent({ resourceChange: 30, waste: 5 })

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          sourceActor: defaultActor,
          targetActor: defaultActor,
        }),
        mockThreatConfig,
      )

      // Only 25 rage actually gained (30 - 5 waste), threat = 25 * 5 = 125
      expect(result.amount).toBe(25)
      expect(result.baseThreat).toBe(125)
    })

    it('ignores class base threat factor for resource generation', () => {
      const event = createEnergizeEvent({ resourceChange: 30 })

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          sourceActor: { id: 1, name: 'RoguePlayer', class: 'rogue' },
          targetActor: defaultActor,
        }),
        mockThreatConfig,
      )

      expect(result.baseThreat).toBe(150)
      expect(result.modifiedThreat).toBe(150)
      expect(result.modifiers).toEqual([])
    })

    it('ignores aura modifiers for resource generation', () => {
      const event = createEnergizeEvent({ resourceChange: 30 })

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          sourceAuras: new Set([
            SPELLS.DEFENSIVE_STANCE,
            SPELLS.BLESSING_OF_SALVATION,
          ]),
          sourceActor: defaultActor,
          targetActor: defaultActor,
        }),
        mockThreatConfig,
      )

      expect(result.baseThreat).toBe(150)
      expect(result.modifiedThreat).toBe(150)
      expect(result.modifiers).toEqual([])
    })

    it('applies player multipliers when energize formula opts in', () => {
      const event = createEnergizeEvent({ resourceChange: 30 })
      const configWithCoeffEnergize = createMockThreatConfig({
        ...mockThreatConfig,
        baseThreat: {
          ...mockThreatConfig.baseThreat,
          energize: (ctx: ThreatContext) => ({
            formula: '(base) 5 * resourceChange',
            value: ctx.amount * 5,
            splitAmongEnemies: true,
            applyPlayerMultipliers: true,
          }),
        },
      })

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          sourceAuras: new Set([SPELLS.DEFENSIVE_STANCE]),
          sourceActor: defaultActor,
          targetActor: defaultActor,
        }),
        configWithCoeffEnergize,
      )

      expect(result.baseThreat).toBe(150)
      expect(result.modifiedThreat).toBe(195)
      expect(result.modifiers).toContainEqual(
        expect.objectContaining({ name: 'Defensive Stance', value: 1.3 }),
      )
    })

    it('treats resourcechange as energize for fallback threat', () => {
      const event = createResourceChangeEvent({ resourceChange: 30 })

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          sourceActor: defaultActor,
          targetActor: defaultActor,
        }),
        mockThreatConfig,
      )

      expect(result.amount).toBe(30)
      expect(result.baseThreat).toBe(150)
    })

    it('handles numeric resource type codes in formulas', () => {
      const resourceAwareConfig = createMockThreatConfig({
        ...mockConfig,
        baseThreat: {
          ...mockConfig.baseThreat,
          energize: (ctx: ThreatContext) => {
            const event = ctx.event
            if (event.type !== 'energize' && event.type !== 'resourcechange') {
              return { formula: '0', value: 0, splitAmongEnemies: false }
            }
            const resourceLabelByCode: Record<number, string> = {
              [ResourceTypeCode.Mana]: 'mana',
              [ResourceTypeCode.Rage]: 'rage',
              [ResourceTypeCode.Focus]: 'focus',
              [ResourceTypeCode.Energy]: 'energy',
              [ResourceTypeCode.ComboPoints]: 'combo_points',
              [ResourceTypeCode.RunicPower]: 'runic_power',
              [ResourceTypeCode.HolyPower]: 'holy_power',
            }

            if (event.resourceChangeType === ResourceTypeCode.Energy) {
              return {
                formula: '0',
                value: 0,
                splitAmongEnemies: false,
                applyPlayerMultipliers: false,
              }
            }

            const multiplier =
              event.resourceChangeType === ResourceTypeCode.Rage ? 5 : 0.5
            return {
              formula: `${resourceLabelByCode[event.resourceChangeType]} * ${multiplier}`,
              value: ctx.amount * multiplier,
              splitAmongEnemies: true,
              applyPlayerMultipliers: false,
            }
          },
        },
      })

      const manaEvent = {
        ...createResourceChangeEvent({ resourceChange: 30 }),
        resourceChangeType: ResourceTypeCode.Mana,
      } as unknown as WCLEvent
      const manaResult = calculateModifiedThreat(
        manaEvent,
        createTestOptions({
          sourceActor: defaultActor,
          targetActor: defaultActor,
        }),
        resourceAwareConfig,
      )

      expect(manaResult.formula).toBe('mana * 0.5')
      expect(manaResult.baseThreat).toBe(15)

      const energyEvent = {
        ...createResourceChangeEvent({ resourceChange: 30 }),
        resourceChangeType: ResourceTypeCode.Energy,
      } as unknown as WCLEvent
      const energyResult = calculateModifiedThreat(
        energyEvent,
        createTestOptions({
          sourceActor: defaultActor,
          targetActor: defaultActor,
        }),
        resourceAwareConfig,
      )

      expect(energyResult.formula).toBe('0')
      expect(energyResult.baseThreat).toBe(0)
    })
  })

  describe('unknown event types', () => {
    it('returns zero threat for unsupported event types', () => {
      // Cast events don't generate threat directly (no amount)
      const event: WCLEvent = {
        timestamp: 1000,
        type: 'cast' as const,
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 99,
        targetIsFriendly: false,
        abilityGameID: 100,
      }

      const result = calculateModifiedThreat(
        event as WCLEvent,
        createTestOptions(),
        mockThreatConfig,
      )

      expect(result.baseThreat).toBe(0)
      expect(result.formula).toBe('0')
    })
  })

  describe('edge cases', () => {
    it('handles empty enemy list', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          enemies: [],
        }),
        mockThreatConfig,
      )

      // With no enemies, threat is still calculated
      expect(result.baseThreat).toBe(1000)
    })

    it('handles actors without class', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateModifiedThreat(
        event,
        createTestOptions({
          sourceActor: { id: 99, name: 'Pet', class: null },
        }),
        mockThreatConfig,
      )

      // Should still calculate base threat without class modifiers
      expect(result.baseThreat).toBe(1000)
    })
  })

  describe('aura modifiers', () => {
    describe('cross-class aura modifiers', () => {
      it('applies Blessing of Salvation to Warriors', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateModifiedThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([SPELLS.BLESSING_OF_SALVATION]),
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig,
        )

        expect(result.modifiers).toContainEqual(
          expect.objectContaining({
            name: 'Blessing of Salvation',
            value: 0.7,
          }),
        )
        // 1000 * 0.7 = 700
        expect(result.modifiedThreat).toBe(700)
      })

      it('applies Blessing of Salvation to Rogues and stacks with base threat', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateModifiedThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([SPELLS.BLESSING_OF_SALVATION]),
            sourceActor: { id: 1, name: 'RoguePlayer', class: 'rogue' },
          }),
          mockThreatConfig,
        )

        expect(result.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Rogue', value: 0.71 }),
        )
        expect(result.modifiers).toContainEqual(
          expect.objectContaining({
            name: 'Blessing of Salvation',
            value: 0.7,
          }),
        )
        // 1000 * 0.71 * 0.7 = 497
        expect(result.modifiedThreat).toBeCloseTo(497, 0)
      })

      it('applies Greater Blessing of Salvation to Mages', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateModifiedThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([SPELLS.GREATER_BLESSING_OF_SALVATION]),
            sourceActor: { id: 1, name: 'MagePlayer', class: 'mage' },
          }),
          mockThreatConfig,
        )

        expect(result.modifiers).toContainEqual(
          expect.objectContaining({
            name: 'Greater Blessing of Salvation',
            value: 0.7,
          }),
        )
        // 1000 * 0.7 = 700
        expect(result.modifiedThreat).toBe(700)
      })
    })

    describe('global aura modifiers', () => {
      it('applies Fetish of the Sand Reaver to Warriors', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateModifiedThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([SPELLS.FETISH_OF_THE_SAND_REAVER]),
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig,
        )

        expect(result.modifiers).toContainEqual(
          expect.objectContaining({
            name: 'Fetish of the Sand Reaver',
            value: 0.3,
          }),
        )
        // 1000 * 0.3 = 300
        expect(result.modifiedThreat).toBe(300)
      })

      it('applies Fetish of the Sand Reaver to Mages', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateModifiedThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([SPELLS.FETISH_OF_THE_SAND_REAVER]),
            sourceActor: { id: 1, name: 'MagePlayer', class: 'mage' },
          }),
          mockThreatConfig,
        )

        expect(result.modifiers).toContainEqual(
          expect.objectContaining({
            name: 'Fetish of the Sand Reaver',
            value: 0.3,
          }),
        )
        // 1000 * 0.3 = 300
        expect(result.modifiedThreat).toBe(300)
      })
    })

    describe('aura modifier stacking and merge behavior', () => {
      it('stacks cross-class buff with class-specific stance', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateModifiedThreat(
          event,
          createTestOptions({
            // Defensive Stance (1.3x) + Blessing of Salvation (0.7x)
            sourceAuras: new Set([
              SPELLS.DEFENSIVE_STANCE,
              SPELLS.BLESSING_OF_SALVATION,
            ]),
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig,
        )

        expect(result.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Defensive Stance', value: 1.3 }),
        )
        expect(result.modifiers).toContainEqual(
          expect.objectContaining({
            name: 'Blessing of Salvation',
            value: 0.7,
          }),
        )
        // 1000 * 1.3 * 0.7 = 910
        expect(result.modifiedThreat).toBeCloseTo(910, 0)
      })

      it('stacks multiple cross-class buffs', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateModifiedThreat(
          event,
          createTestOptions({
            // Blessing of Salvation (0.7x) + Fetish of the Sand Reaver (0.3x)
            sourceAuras: new Set([
              SPELLS.BLESSING_OF_SALVATION,
              SPELLS.FETISH_OF_THE_SAND_REAVER,
            ]),
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig,
        )

        expect(result.modifiers).toContainEqual(
          expect.objectContaining({
            name: 'Blessing of Salvation',
            value: 0.7,
          }),
        )
        expect(result.modifiers).toContainEqual(
          expect.objectContaining({
            name: 'Fetish of the Sand Reaver',
            value: 0.3,
          }),
        )
        // 1000 * 0.7 * 0.3 = 210
        expect(result.modifiedThreat).toBe(210)
      })

      it('stacks three modifiers (class stance + talent + cross-class buff)', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateModifiedThreat(
          event,
          createTestOptions({
            // Defensive Stance (1.3x) + Defiance Rank 5 (1.15x) + Blessing of Salvation (0.7x)
            sourceAuras: new Set([
              SPELLS.DEFENSIVE_STANCE,
              SPELLS.DEFIANCE_RANK_5,
              SPELLS.BLESSING_OF_SALVATION,
            ]),
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig,
        )

        expect(result.modifiers).toHaveLength(3)
        // 1000 * 1.3 * 1.15 * 0.7 = 1046.5
        expect(result.modifiedThreat).toBeCloseTo(1046.5, 0)
      })
    })

    describe('class-specific aura modifiers still work', () => {
      it('applies Defensive Stance to Warriors', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateModifiedThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([SPELLS.DEFENSIVE_STANCE]),
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig,
        )

        expect(result.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Defensive Stance', value: 1.3 }),
        )
        expect(result.modifiedThreat).toBe(1300)
      })

      it('applies Bear Form to Druids', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateModifiedThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([SPELLS.BEAR_FORM]),
            sourceActor: { id: 1, name: 'DruidPlayer', class: 'druid' },
          }),
          mockThreatConfig,
        )

        expect(result.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Bear Form', value: 1.3 }),
        )
        expect(result.modifiedThreat).toBe(1300)
      })

      it('applies Righteous Fury to Paladin holy spells only', () => {
        const holyDamageEvent = createDamageEvent({
          amount: 1000,
          abilityGameID: SPELLS.SEAL_OF_RIGHTEOUSNESS,
        })

        const physicalDamageEvent = createDamageEvent({
          amount: 1000,
          abilityGameID: SPELLS.SEAL_OF_RIGHTEOUSNESS,
        })

        const holyResult = calculateModifiedThreat(
          holyDamageEvent,
          createTestOptions({
            sourceAuras: new Set([SPELLS.RIGHTEOUS_FURY]),
            spellSchoolMask: SpellSchool.Holy,
            sourceActor: { id: 1, name: 'PaladinPlayer', class: 'paladin' },
          }),
          mockThreatConfig,
        )

        // Righteous Fury should apply to holy spells
        expect(holyResult.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Righteous Fury', value: 1.6 }),
        )

        const physicalResult = calculateModifiedThreat(
          physicalDamageEvent,
          createTestOptions({
            sourceAuras: new Set([SPELLS.RIGHTEOUS_FURY]),
            spellSchoolMask: SpellSchool.Physical,
            sourceActor: { id: 1, name: 'PaladinPlayer', class: 'paladin' },
          }),
          mockThreatConfig,
        )

        // Righteous Fury should NOT apply to non-holy schools
        expect(
          physicalResult.modifiers.find((m) => m.name === 'Righteous Fury'),
        ).toBeUndefined()
      })

      it('does not apply school-scoped modifiers when event school is unavailable', () => {
        const eventWithoutSchool = createDamageEvent({
          amount: 1000,
          abilityGameID: SPELLS.SEAL_OF_RIGHTEOUSNESS,
        })

        const result = calculateModifiedThreat(
          eventWithoutSchool,
          createTestOptions({
            sourceAuras: new Set([SPELLS.RIGHTEOUS_FURY]),
            sourceActor: { id: 1, name: 'PaladinPlayer', class: 'paladin' },
          }),
          mockThreatConfig,
        )

        expect(
          result.modifiers.find((m) => m.name === 'Righteous Fury'),
        ).toBeUndefined()
      })

      it('applies Defiance talent to Warriors', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateModifiedThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([SPELLS.DEFIANCE_RANK_5]),
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig,
        )

        expect(result.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Defiance (Rank 5)', value: 1.15 }),
        )
        expect(result.modifiedThreat).toBe(1150)
      })
    })
  })
})

describe('calculateThreatModification', () => {
  it('multiplies current threat by multiplier', () => {
    expect(calculateThreatModification(1000, 0.5)).toBe(500)
    expect(calculateThreatModification(5000, 0.25)).toBe(1250)
    expect(calculateThreatModification(1000, 2)).toBe(2000)
  })

  it('wipes threat when multiplier is 0', () => {
    expect(calculateThreatModification(10000, 0)).toBe(0)
    expect(calculateThreatModification(1, 0)).toBe(0)
  })

  it('clamps negative results to 0', () => {
    expect(calculateThreatModification(1000, -1)).toBe(0)
    expect(calculateThreatModification(500, -0.5)).toBe(0)
  })

  it('handles edge cases', () => {
    expect(calculateThreatModification(0, 0.5)).toBe(0)
    expect(calculateThreatModification(0, 0)).toBe(0)
    expect(calculateThreatModification(1000, 1)).toBe(1000)
    expect(calculateThreatModification(1000, 1.5)).toBe(1500)
  })

  it('handles very large multipliers', () => {
    expect(calculateThreatModification(1000, 100)).toBe(100000)
  })

  it('handles very small multipliers', () => {
    expect(calculateThreatModification(1000, 0.001)).toBe(1)
    expect(calculateThreatModification(1000, 0.0001)).toBe(0.1)
  })
})

describe('combatantinfo processing', () => {
  it('applies pre-seeded initial auras before the first event', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      initialAurasByActor: new Map([
        [warriorActor.id, [SPELLS.MOCK_AURA_THREAT_UP]],
      ]),
      actorMap,
      enemies,
      config: mockConfig,
    })

    const damageEvent = result.augmentedEvents[0]
    const threatUpModifier = damageEvent?.threat?.calculation.modifiers.find(
      (m: ThreatModifier) => m.name === 'Test Threat Up',
    )

    expect(threatUpModifier).toBeDefined()
    expect(result.eventCounts.combatantinfo).toBeUndefined()
  })

  it('seeds auras from combatantinfo and applies them to subsequent damage events', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const combatantInfo: WCLEvent = {
      timestamp: 1000,
      type: 'combatantinfo',
      sourceID: warriorActor.id,
      sourceIsFriendly: true,
      targetID: warriorActor.id,
      targetIsFriendly: true,
      auras: [
        createCombatantInfoAura(SPELLS.MOCK_AURA_THREAT_UP, 'Test Threat Up'),
      ],
      gear: [],
    }

    // Damage event after combatantinfo should have the aura modifier applied
    const events: WCLEvent[] = [
      combatantInfo,
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    // Should have one augmented damage event
    expect(result.augmentedEvents.length).toBe(2)
    expect(result.eventCounts.combatantinfo).toBe(1)

    // The damage event should have the aura modifier from combatantinfo
    const damageEvent = result.augmentedEvents.find((e) => e.type === 'damage')
    const threatUpModifier = damageEvent?.threat!.calculation.modifiers.find(
      (m: ThreatModifier) => m.name === 'Test Threat Up',
    )
    expect(threatUpModifier).toBeDefined()
    expect(threatUpModifier?.value).toBe(1.5)
  })

  it('injects synthetic auras from gear implications and applies them to threat', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const combatantInfo: WCLEvent = {
      timestamp: 1000,
      type: 'combatantinfo',
      sourceID: warriorActor.id,
      sourceIsFriendly: true,
      targetID: warriorActor.id,
      targetIsFriendly: true,
      auras: [],
      gear: [
        { id: 1, setID: 1 }, // Item with set bonus - triggers gearImplications
      ],
    }

    // Follow with damage to verify gear implications injected the aura
    const events: WCLEvent[] = [
      combatantInfo,
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    // Damage event should be present with the synthetic aura modifier
    expect(result.augmentedEvents.length).toBe(2)
    const damageEvent = result.augmentedEvents.find((e) => e.type === 'damage')
    const setBonusModifier = damageEvent?.threat!.calculation.modifiers.find(
      (m: ThreatModifier) => m.source === 'gear',
    )
    expect(setBonusModifier).toBeDefined()
    expect(setBonusModifier?.value).toBe(0.8)
  })

  it('injects synthetic auras from combatant talent implications', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const combatantInfo: WCLEvent = {
      timestamp: 1000,
      type: 'combatantinfo',
      sourceID: warriorActor.id,
      sourceIsFriendly: true,
      targetID: warriorActor.id,
      targetIsFriendly: true,
      talents: [
        { id: 14, icon: '' },
        { id: 5, icon: '' },
        { id: 31, icon: '' },
      ],
    }

    const events: WCLEvent[] = [
      combatantInfo,
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    const damageEvent = result.augmentedEvents.find((e) => e.type === 'damage')
    const talentModifier = damageEvent?.threat!.calculation.modifiers.find(
      (m: ThreatModifier) => m.source === 'talent',
    )
    expect(talentModifier).toBeDefined()
    expect(talentModifier?.name).toBe('Defiance (Rank 5)')
    expect(talentModifier?.value).toBe(1.15)
  })

  it('processes combatantinfo for unknown actor gracefully', () => {
    const actorMap = new Map<number, Actor>() // Empty - actor not known

    const combatantInfo: WCLEvent = {
      timestamp: 1000,
      type: 'combatantinfo',
      sourceID: 99, // Unknown actor
      sourceIsFriendly: true,
      targetID: 99,
      targetIsFriendly: true,
      auras: [
        createCombatantInfoAura(
          SPELLS.DEFENSIVE_STANCE,
          'Defensive Stance',
          99,
        ),
      ],
    }

    const events: WCLEvent[] = [combatantInfo]

    // Should not throw for unknown actor
    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    expect(result.eventCounts.combatantinfo).toBe(1)
  })
})

describe('cast aura implications', () => {
  it('infers cat form from rake cast when no cat form aura event exists', () => {
    const actorMap = new Map<number, Actor>([[druidActor.id, druidActor]])

    const events: WCLEvent[] = [
      {
        timestamp: 1000,
        type: 'cast',
        sourceID: druidActor.id,
        sourceIsFriendly: true,
        targetID: bossEnemy.id,
        targetIsFriendly: false,
        abilityGameID: SPELLS.RAKE,
      },
      createDamageEvent({
        timestamp: 1100,
        sourceID: druidActor.id,
        targetID: bossEnemy.id,
        targetIsFriendly: false,
        abilityGameID: SPELLS.RAKE,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    const damageEvent = result.augmentedEvents.find((e) => e.type === 'damage')
    const catFormModifier = damageEvent?.threat!.calculation.modifiers.find(
      (m: ThreatModifier) => m.name === 'Cat Form',
    )

    expect(catFormModifier).toBeDefined()
    expect(catFormModifier?.value).toBe(0.71)
  })
})

describe('aura tracking', () => {
  it('tracks auras from applybuff and removebuff events', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      // Apply threat up aura
      createApplyBuffEvent({
        targetID: warriorActor.id,
        abilityGameID: SPELLS.MOCK_AURA_THREAT_UP,
      }),
      // Damage event should get the aura modifier
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
      // Remove threat up aura
      createRemoveBuffEvent({
        targetID: warriorActor.id,
        abilityGameID: SPELLS.MOCK_AURA_THREAT_UP,
      }),
      // Damage event should not get the aura modifier
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    // Apply/remove aura events are now augmented too
    expect(result.augmentedEvents.length).toBe(4)

    // First event should have the threat up modifier (1.5x)
    const firstEvent = result.augmentedEvents.find((e) => e.type === 'damage')
    expect(firstEvent?.threat).toBeDefined()
    const firstThreatUpModifier =
      firstEvent?.threat!.calculation.modifiers.find(
        (m: ThreatModifier) => m.name === 'Test Threat Up',
      )
    expect(firstThreatUpModifier).toBeDefined()
    expect(firstThreatUpModifier?.value).toBe(1.5)

    // Second damage event should not have the threat up modifier
    const secondEvent = result.augmentedEvents
      .filter((e) => e.type === 'damage')
      .at(1)
    const secondThreatUpModifier =
      secondEvent?.threat!.calculation.modifiers.find(
        (m: ThreatModifier) => m.name === 'Test Threat Up',
      )
    expect(secondThreatUpModifier).toBeUndefined()
  })

  it('tracks auras from refresh and stack aura events', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      createRefreshBuffEvent({
        targetID: warriorActor.id,
        abilityGameID: SPELLS.MOCK_AURA_THREAT_UP,
      }),
      createApplyBuffStackEvent({
        targetID: warriorActor.id,
        abilityGameID: SPELLS.MOCK_AURA_THREAT_DOWN,
        stacks: 2,
      }),
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    const damageEvent = result.augmentedEvents.find((e) => e.type === 'damage')
    expect(damageEvent?.threat!.calculation.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Test Threat Up', value: 1.5 }),
        expect.objectContaining({ name: 'Test Threat Down', value: 0.5 }),
      ]),
    )
  })

  it('emits phased state specials for invulnerability aura events', () => {
    const INVULN_SPELL = 642
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])
    const config = createMockThreatConfig({
      invulnerabilityBuffs: new Set([INVULN_SPELL]),
    })

    const result = processEvents({
      rawEvents: [
        createApplyBuffEvent({
          sourceID: warriorActor.id,
          targetID: warriorActor.id,
          abilityGameID: INVULN_SPELL,
        }),
        createRemoveBuffEvent({
          sourceID: warriorActor.id,
          targetID: warriorActor.id,
          abilityGameID: INVULN_SPELL,
        }),
      ],
      actorMap,
      enemies,
      config,
    })

    expect(result.augmentedEvents).toHaveLength(2)

    const startSpecial =
      result.augmentedEvents[0]?.threat!.calculation.effects?.[0]
    expect(startSpecial).toEqual({
      type: 'state',
      state: {
        kind: 'invulnerable',
        phase: 'start',
        spellId: INVULN_SPELL,
        actorId: warriorActor.id,
        name: `Spell ${INVULN_SPELL}`,
      },
    })

    const endSpecial =
      result.augmentedEvents[1]?.threat!.calculation.effects?.[0]
    expect(endSpecial).toEqual({
      type: 'state',
      state: {
        kind: 'invulnerable',
        phase: 'end',
        spellId: INVULN_SPELL,
        actorId: warriorActor.id,
      },
    })
  })

  it('emits phased state specials for refresh and remove-stack aura events', () => {
    const INVULN_SPELL = 642
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])
    const config = createMockThreatConfig({
      invulnerabilityBuffs: new Set([INVULN_SPELL]),
    })

    const result = processEvents({
      rawEvents: [
        createRefreshBuffEvent({
          sourceID: warriorActor.id,
          targetID: warriorActor.id,
          abilityGameID: INVULN_SPELL,
        }),
        createRemoveBuffStackEvent({
          sourceID: warriorActor.id,
          targetID: warriorActor.id,
          abilityGameID: INVULN_SPELL,
          stacks: 0,
        }),
      ],
      actorMap,
      enemies,
      config,
    })

    expect(result.augmentedEvents).toHaveLength(2)

    const refreshSpecial =
      result.augmentedEvents[0]?.threat!.calculation.effects?.[0]
    expect(refreshSpecial).toEqual({
      type: 'state',
      state: {
        kind: 'invulnerable',
        phase: 'start',
        spellId: INVULN_SPELL,
        actorId: warriorActor.id,
        name: `Spell ${INVULN_SPELL}`,
      },
    })

    const removeStackSpecial =
      result.augmentedEvents[1]?.threat!.calculation.effects?.[0]
    expect(removeStackSpecial).toEqual({
      type: 'state',
      state: {
        kind: 'invulnerable',
        phase: 'end',
        spellId: INVULN_SPELL,
        actorId: warriorActor.id,
      },
    })
  })

  it('applies taunt custom threat and emits fixate state on aura events', () => {
    const TAUNT_SPELL = 355
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])
    const config = createMockThreatConfig({
      classes: {
        warrior: {
          baseThreatFactor: 1.0,
          auraModifiers: {},
          abilities: {
            [TAUNT_SPELL]: (ctx) =>
              ctx.event.type === 'applydebuff'
                ? {
                    formula: 'taunt set',
                    value: 0,
                    splitAmongEnemies: false,
                    effects: [
                      {
                        type: 'customThreat',
                        changes: [
                          {
                            sourceId: warriorActor.id,
                            targetId: bossEnemy.id,
                            targetInstance: 0,
                            operator: 'set',
                            amount: 501,
                            total: 501,
                          },
                        ],
                      },
                    ],
                  }
                : {
                    formula: '0',
                    value: 0,
                    splitAmongEnemies: false,
                  },
          },
          fixateBuffs: new Set([TAUNT_SPELL]),
        },
      },
    })

    const result = processEvents({
      rawEvents: [
        createApplyDebuffEvent({
          sourceID: warriorActor.id,
          sourceIsFriendly: true,
          targetID: bossEnemy.id,
          targetIsFriendly: false,
          abilityGameID: TAUNT_SPELL,
        }),
        createRemoveDebuffEvent({
          sourceID: warriorActor.id,
          sourceIsFriendly: true,
          targetID: bossEnemy.id,
          targetIsFriendly: false,
          abilityGameID: TAUNT_SPELL,
        }),
      ],
      actorMap,
      enemies: [bossEnemy],
      config,
    })

    const startEvent = result.augmentedEvents[0]
    expect(startEvent?.threat!.changes).toEqual([
      {
        sourceId: warriorActor.id,
        targetId: bossEnemy.id,
        targetInstance: 0,
        operator: 'set',
        amount: 501,
        total: 501,
      },
    ])
    expect(startEvent?.threat!.calculation.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'customThreat',
        }),
        {
          type: 'state',
          state: {
            kind: 'fixate',
            phase: 'start',
            spellId: TAUNT_SPELL,
            actorId: warriorActor.id,
            targetId: bossEnemy.id,
            targetInstance: 0,
            name: `Spell ${TAUNT_SPELL}`,
          },
        },
      ]),
    )

    const endEvent = result.augmentedEvents[1]
    expect(endEvent?.threat!.changes).toBeUndefined()
    expect(endEvent?.threat!.calculation.effects).toEqual([
      {
        type: 'state',
        state: {
          kind: 'fixate',
          phase: 'end',
          spellId: TAUNT_SPELL,
          actorId: warriorActor.id,
          targetId: bossEnemy.id,
          targetInstance: 0,
        },
      },
    ])
  })

  it('applies aura modifiers correctly from combatantinfo', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      // Combatantinfo with aura active
      {
        timestamp: 1000,
        type: 'combatantinfo',
        sourceID: warriorActor.id,
        sourceIsFriendly: true,
        targetID: warriorActor.id,
        targetIsFriendly: true,
        auras: [
          createCombatantInfoAura(SPELLS.MOCK_AURA_THREAT_UP, 'Test Threat Up'),
        ],
        gear: [],
      },
      // Damage event should have aura modifier
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    const damageEvent = result.augmentedEvents.find((e) => e.type === 'damage')
    expect(damageEvent?.threat).toBeDefined()

    // Check for the threat up modifier
    const threatUpModifier = damageEvent?.threat!.calculation.modifiers.find(
      (m: ThreatModifier) => m.name === 'Test Threat Up',
    )
    expect(threatUpModifier).toBeDefined()
    expect(threatUpModifier?.value).toBe(1.5)
  })

  it('applies class base threat factor', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    const damageEvent = result.augmentedEvents.find((e) => e.type === 'damage')
    const classModifier = damageEvent?.threat!.calculation.modifiers.find(
      (m: ThreatModifier) => m.source === 'class',
    )
    expect(classModifier).toBeDefined()
    expect(classModifier?.value).toBe(1.3)
  })
})

describe('ability-specific threat calculation', () => {
  it('uses custom ability formula when configured', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        abilityGameID: SPELLS.MOCK_ABILITY_1,
        amount: 200,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    const augmented = result.augmentedEvents[0]
    // Custom formula: amount + 100 = 300
    expect(augmented?.threat!.calculation.baseThreat).toBe(300)
    expect(augmented?.threat!.calculation.formula).toBe('(custom) amt + 100')
  })

  it('runs ability formulas on refresh and stack aura phases', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      createRefreshBuffEvent({
        sourceID: warriorActor.id,
        targetID: warriorActor.id,
        abilityGameID: SPELLS.MOCK_ABILITY_1,
      }),
      createApplyDebuffStackEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        targetIsFriendly: false,
        abilityGameID: SPELLS.MOCK_ABILITY_1,
        stacks: 2,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    expect(result.augmentedEvents).toHaveLength(2)
    expect(result.augmentedEvents[0]?.threat!.calculation.baseThreat).toBe(100)
    expect(result.augmentedEvents[1]?.threat!.calculation.baseThreat).toBe(100)
  })

  it('runs ability formulas on cast phase events', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const castEvent: WCLEvent = {
      timestamp: 1000,
      type: 'cast',
      sourceID: warriorActor.id,
      sourceIsFriendly: true,
      targetID: bossEnemy.id,
      targetIsFriendly: false,
      abilityGameID: SPELLS.MOCK_ABILITY_1,
    }

    const result = processEvents({
      rawEvents: [castEvent],
      actorMap,
      enemies,
      config: mockConfig,
    })

    const augmented = result.augmentedEvents[0]
    expect(augmented?.threat!.calculation.baseThreat).toBe(100)
    expect(augmented?.threat!.calculation.formula).toBe('(custom) amt + 100')
  })

  it('treats undefined ability formula result as no threat and does not fall back', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])
    const config = createMockThreatConfig({
      baseThreat: {
        damage: () => ({
          formula: '(base) should not apply',
          value: 999,
          splitAmongEnemies: false,
        }),
        absorbed: mockConfig.baseThreat.absorbed,
        heal: mockConfig.baseThreat.heal,
        energize: mockConfig.baseThreat.energize,
      },
      classes: {
        warrior: {
          baseThreatFactor: 1.0,
          auraModifiers: {},
          abilities: {
            [SPELLS.MOCK_ABILITY_1]: () => undefined,
          },
        },
      },
    })

    const result = processEvents({
      rawEvents: [
        createDamageEvent({
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          abilityGameID: SPELLS.MOCK_ABILITY_1,
          amount: 250,
        }),
      ],
      actorMap,
      enemies,
      config,
    })

    const augmented = result.augmentedEvents[0]
    expect(augmented?.threat!.calculation.baseThreat).toBe(0)
    expect(augmented?.threat!.calculation.formula).toBe('0')
    expect(augmented?.threat!.changes).toBeUndefined()
  })

  it('splits threat among enemies when configured', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        abilityGameID: SPELLS.MOCK_ABILITY_2,
        amount: 200,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    const augmented = result.augmentedEvents[0]
    // Calculation: 200 * 0.5 = 100 base, class factor 1.3x = 130, split among 2 enemies = 65 each
    expect(augmented?.threat!.changes).toEqual([
      expect.objectContaining({
        targetId: 99,
        amount: 65,
        sourceId: 1,
        operator: 'add',
      }),
      expect.objectContaining({
        targetId: 100,
        amount: 65,
        sourceId: 1,
        operator: 'add',
      }),
    ])
    expect(augmented?.threat!.calculation).toEqual(
      expect.objectContaining({ isSplit: true, modifiedThreat: 130 }),
    )
  })
})

describe('base threat calculations', () => {
  it('calculates threat for damage events using base formula', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 500,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    expect(result.augmentedEvents.length).toBe(1)

    const augmented = result.augmentedEvents[0]
    expect(augmented?.threat!.calculation.formula).toBe('(base) 2 * damage')
  })

  it('calculates threat for heal events using base formula', () => {
    const actorMap = new Map<number, Actor>([[priestActor.id, priestActor]])

    const events: WCLEvent[] = [
      createHealEvent({
        sourceID: priestActor.id,
        targetID: warriorActor.id,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    expect(result.augmentedEvents.length).toBe(1)

    const augmented = result.augmentedEvents[0]
    expect(augmented?.threat!.calculation.formula).toBe('(base) 0.5 * heal')
  })

  it('applies damage threat to single target', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    const augmented = result.augmentedEvents[0]
    expect(augmented?.threat).toEqual(
      expect.objectContaining({
        changes: [
          expect.objectContaining({
            amount: 260,
            targetId: 99,
            operator: 'add',
            sourceId: 1,
            total: 260,
          }),
        ],
      }),
    )
  })

  it('includes friendly-target damage event with no applied threat changes', () => {
    const actorMap = new Map<number, Actor>([
      [warriorActor.id, warriorActor],
      [priestActor.id, priestActor],
    ])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: priestActor.id, // Friendly target
        targetIsFriendly: true,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    expect(result.augmentedEvents.length).toBe(1)
    expect(result.augmentedEvents[0]?.threat).toBeDefined()
    expect(result.augmentedEvents[0]?.threat!.changes).toBeUndefined()
  })

  it('includes boss melee on friendly targets as zero-threat marker events', () => {
    const actorMap = new Map<number, Actor>([
      [warriorActor.id, warriorActor],
      [bossEnemy.id, { id: bossEnemy.id, name: 'Boss', class: null }],
    ])
    const friendlyActorIds = new Set([warriorActor.id])
    const bossMeleeEvent = createDamageEvent({
      sourceID: bossEnemy.id,
      targetID: warriorActor.id,
      abilityGameID: 1,
      amount: 500,
    })
    const events: WCLEvent[] = [bossMeleeEvent]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      friendlyActorIds,
      enemies,
      config: mockConfig,
    })

    expect(result.augmentedEvents).toHaveLength(1)
    expect(result.augmentedEvents[0]?.type).toBe('damage')
    expect(result.augmentedEvents[0]?.threat!.calculation.formula).toBe(
      '0 (boss melee marker)',
    )
    expect(result.augmentedEvents[0]?.threat!.calculation.amount).toBe(500)
    expect(result.augmentedEvents[0]?.threat!.calculation.effects).toEqual([
      {
        type: 'eventMarker',
        marker: 'bossMelee',
      },
    ])
    expect(result.augmentedEvents[0]?.threat!.changes).toEqual([])
  })

  it('includes hostile damage to friendly targets with no applied threat changes', () => {
    const actorMap = new Map<number, Actor>([
      [warriorActor.id, warriorActor],
      [bossEnemy.id, { id: bossEnemy.id, name: 'Boss', class: null }],
    ])
    const friendlyActorIds = new Set([warriorActor.id])
    const untrackedBossDamageEvent = createDamageEvent({
      sourceID: bossEnemy.id,
      targetID: warriorActor.id,
      abilityGameID: SPELLS.MOCK_ABILITY_1,
      amount: 500,
    })
    const events: WCLEvent[] = [untrackedBossDamageEvent]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      friendlyActorIds,
      enemies,
      config: mockConfig,
    })

    expect(result.augmentedEvents).toHaveLength(1)
    expect(result.augmentedEvents[0]?.threat).toBeDefined()
    expect(result.augmentedEvents[0]?.threat!.changes).toBeUndefined()
  })

  it('includes threat payload for resourcechange events', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])
    const events: WCLEvent[] = [
      createResourceChangeEvent({
        sourceID: warriorActor.id,
        targetID: warriorActor.id,
        resourceChange: 30,
        resourceChangeType: ResourceTypeCode.Rage,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    expect(result.augmentedEvents).toHaveLength(1)
    expect(result.augmentedEvents[0]?.type).toBe('resourcechange')
    expect(result.augmentedEvents[0]?.threat).toBeDefined()
    expect(result.augmentedEvents[0]?.threat!.calculation.baseThreat).toBe(15)
  })

  it('attributes absorbed threat to the absorbed caster sourceID', () => {
    const actorMap = new Map<number, Actor>([
      [warriorActor.id, warriorActor],
      [priestActor.id, priestActor],
    ])
    const events: WCLEvent[] = [
      createAbsorbedEvent({
        sourceID: priestActor.id,
        targetID: warriorActor.id,
        attackerID: bossEnemy.id,
        abilityGameID: 10901,
        amount: 400,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    expect(result.augmentedEvents).toHaveLength(1)
    expect(result.augmentedEvents[0]?.type).toBe('absorbed')
    expect(result.augmentedEvents[0]?.threat!.calculation.baseThreat).toBe(400)
    expect(result.augmentedEvents[0]?.threat!.calculation.isSplit).toBe(false)
    expect(result.augmentedEvents[0]?.threat!.changes).toEqual([
      {
        sourceId: priestActor.id,
        targetId: bossEnemy.id,
        targetInstance: bossEnemy.instance,
        operator: 'add',
        amount: 400,
        total: 400,
      },
    ])
  })

  it('preserves numeric resource type codes on augmented events', () => {
    const resourceAwareConfig = createMockThreatConfig({
      ...mockConfig,
      baseThreat: {
        ...mockConfig.baseThreat,
        energize: (ctx: ThreatContext) => {
          const event = ctx.event
          if (event.type !== 'energize' && event.type !== 'resourcechange') {
            return { formula: '0', value: 0, splitAmongEnemies: false }
          }
          const resourceLabelByCode: Record<number, string> = {
            [ResourceTypeCode.Mana]: 'mana',
            [ResourceTypeCode.Rage]: 'rage',
            [ResourceTypeCode.Focus]: 'focus',
            [ResourceTypeCode.Energy]: 'energy',
            [ResourceTypeCode.ComboPoints]: 'combo_points',
            [ResourceTypeCode.RunicPower]: 'runic_power',
            [ResourceTypeCode.HolyPower]: 'holy_power',
          }

          if (event.resourceChangeType === ResourceTypeCode.Energy) {
            return {
              formula: '0',
              value: 0,
              splitAmongEnemies: false,
              applyPlayerMultipliers: false,
            }
          }

          const multiplier =
            event.resourceChangeType === ResourceTypeCode.Rage ? 5 : 0.5
          return {
            formula: `${resourceLabelByCode[event.resourceChangeType]} * ${multiplier}`,
            value: ctx.amount * multiplier,
            splitAmongEnemies: true,
            applyPlayerMultipliers: false,
          }
        },
      },
    })
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])
    const events = [
      {
        ...createResourceChangeEvent({
          sourceID: warriorActor.id,
          targetID: warriorActor.id,
          resourceChange: 30,
        }),
        resourceChangeType: ResourceTypeCode.Energy,
      } as unknown as WCLEvent,
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: resourceAwareConfig,
    })

    expect(result.augmentedEvents[0]?.resourceChangeType).toBe(
      ResourceTypeCode.Energy,
    )
    expect(result.augmentedEvents[0]?.threat?.calculation.baseThreat).toBe(0)
  })
})

describe('augmented event structure', () => {
  it('includes all event fields in augmented output', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const damageEvent: DamageEvent = {
      timestamp: 1000,
      type: 'damage',
      sourceID: warriorActor.id,
      targetID: bossEnemy.id,
      sourceInstance: 1,
      targetInstance: 2,
      abilityGameID: SPELLS.MOCK_ABILITY_1,
      amount: 2500,
      absorbed: 100,
      blocked: 200,
      mitigated: 50,
      overkill: 0,
      hitType: 'hit',
      tick: false,
      multistrike: false,
    }

    const events: WCLEvent[] = [damageEvent]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    const augmented = result.augmentedEvents[0]
    expect(augmented?.timestamp).toBe(1000)
    expect(augmented?.type).toBe('damage')
    expect(augmented?.sourceID).toBe(warriorActor.id)
    expect(augmented?.targetID).toBe(bossEnemy.id)
    expect(augmented?.sourceInstance).toBe(1)
    expect(augmented?.targetInstance).toBe(2)
    expect(augmented?.abilityGameID).toBe(SPELLS.MOCK_ABILITY_1)
    expect(augmented?.amount).toBe(2500)
    expect(augmented?.absorbed).toBe(100)
    expect(augmented?.blocked).toBe(200)
    expect(augmented?.mitigated).toBe(50)
    expect(augmented?.hitType).toBe('hit')
    expect(augmented?.tick).toBe(false)
  })

  it('includes absorbed event passthrough fields in augmented output', () => {
    const actorMap = new Map<number, Actor>([
      [warriorActor.id, warriorActor],
      [priestActor.id, priestActor],
    ])
    const absorbedEvent: AbsorbedEvent = {
      timestamp: 1000,
      type: 'absorbed',
      sourceID: priestActor.id,
      targetID: warriorActor.id,
      abilityGameID: 10901,
      amount: 350,
      attackerID: bossEnemy.id,
      extraAbilityGameID: 1,
    }

    const result = processEvents({
      rawEvents: [absorbedEvent],
      actorMap,
      enemies,
      config: mockConfig,
    })

    const augmented = result.augmentedEvents[0]
    expect(augmented?.type).toBe('absorbed')
    expect(augmented?.amount).toBe(350)
    expect(augmented?.attackerID).toBe(bossEnemy.id)
    expect(augmented?.extraAbilityGameID).toBe(1)
  })

  it('includes threat calculation details', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 1000,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    const augmented = result.augmentedEvents[0]
    expect(augmented?.threat!.calculation.formula).toBeDefined()
    expect(augmented?.threat!.calculation.amount).toBe(1000)
    expect(augmented?.threat!.calculation.baseThreat).toBeGreaterThan(0)
    expect(augmented?.threat!.calculation.modifiedThreat).toBeGreaterThan(0)
    expect(augmented?.threat!.calculation.modifiers).toBeDefined()
    expect(Array.isArray(augmented?.threat!.calculation.modifiers)).toBe(true)
  })

  it('doesnt include threat.apply array if threat is 0', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 1000,
        abilityGameID: 101,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: {
        ...mockConfig,
        abilities: {
          [101]: () => ({
            formula: 'zero',
            value: 0,
            splitAmongEnemies: false,
          }),
        },
      },
    })

    const augmented = result.augmentedEvents[0]
    expect(augmented?.threat!.calculation).toEqual(
      expect.objectContaining({ formula: 'zero', modifiedThreat: 0 }),
    )
    expect(augmented?.threat!.changes).toBeUndefined()
  })
})

describe('global config properties', () => {
  it('should merge global and class abilities with class taking precedence', () => {
    const GLOBAL_ABILITY_ID = 88888
    const CLASS_ONLY_ABILITY_ID = 99999

    const customConfig: ThreatConfig = createMockThreatConfig({
      // Global ability
      abilities: {
        [GLOBAL_ABILITY_ID]: (ctx: ThreatContext) => ({
          formula: 'global: 5 * amt',
          value: ctx.amount * 5,
          splitAmongEnemies: false,
        }),
      },
      classes: {
        warrior: {
          baseThreatFactor: 1.3,
          auraModifiers: {},
          abilities: {
            // This should override global config
            [GLOBAL_ABILITY_ID]: (ctx: ThreatContext) => ({
              formula: 'class: 2 * amt',
              value: ctx.amount * 2,
              splitAmongEnemies: false,
            }),
            // This is class-only
            [CLASS_ONLY_ABILITY_ID]: (ctx: ThreatContext) => ({
              formula: 'class-only: 3 * amt',
              value: ctx.amount * 3,
              splitAmongEnemies: false,
            }),
          },
        },
      },
    })

    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      // Duplicate ability: class overrides global
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        abilityGameID: GLOBAL_ABILITY_ID,
        amount: 100,
      }),
      // Class-only ability
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        abilityGameID: CLASS_ONLY_ABILITY_ID,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: customConfig,
    })

    // First event: class formula (2x) overrides global (5x)
    const augmented1 = result.augmentedEvents[0]
    expect(augmented1?.threat!.calculation.baseThreat).toBe(200)
    expect(augmented1?.threat!.calculation.formula).toBe('class: 2 * amt')

    // Second event: class-only formula (3x)
    const augmented2 = result.augmentedEvents[1]
    expect(augmented2?.threat!.calculation.baseThreat).toBe(300)
    expect(augmented2?.threat!.calculation.formula).toBe('class-only: 3 * amt')
  })

  it('should use global auraModifiers and merge with class auraModifiers', () => {
    const GLOBAL_AURA_ID = 77777

    const customConfig: ThreatConfig = createMockThreatConfig({
      // Global aura modifier
      auraModifiers: {
        [GLOBAL_AURA_ID]: () => ({
          source: 'aura',
          name: 'Global Threat Modifier',
          value: 2.0,
        }),
      },
    })

    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      // Apply global aura
      createApplyBuffEvent({
        targetID: warriorActor.id,
        abilityGameID: GLOBAL_AURA_ID,
      }),
      // Damage event should get the global aura modifier
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: customConfig,
    })

    const damageEvent = result.augmentedEvents.find((e) => e.type === 'damage')
    const globalModifier = damageEvent?.threat!.calculation.modifiers.find(
      (m: ThreatModifier) => m.name === 'Global Threat Modifier',
    )
    expect(globalModifier).toBeDefined()
    expect(globalModifier?.value).toBe(2.0)
    expect(globalModifier?.name).toBe('Global Threat Modifier')
  })

  it('should apply both global and class auraModifiers when both are active', () => {
    const GLOBAL_AURA_ID = 77777

    const customConfig: ThreatConfig = createMockThreatConfig({
      auraModifiers: {
        [GLOBAL_AURA_ID]: () => ({
          source: 'aura',
          name: 'Global Threat Modifier',
          value: 2.0,
        }),
      },
      classes: {
        warrior: {
          baseThreatFactor: 1.3,
          auraModifiers: {
            [SPELLS.MOCK_AURA_THREAT_UP]: () => ({
              source: 'buff',
              name: 'Test Threat Up',
              value: 1.5,
            }),
          },
          abilities: {},
        },
      },
    })

    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      // Apply global aura
      createApplyBuffEvent({
        targetID: warriorActor.id,
        abilityGameID: GLOBAL_AURA_ID,
      }),
      // Apply class-specific aura
      createApplyBuffEvent({
        targetID: warriorActor.id,
        abilityGameID: SPELLS.MOCK_AURA_THREAT_UP,
      }),
      // Damage event should get both modifiers
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: customConfig,
    })

    const damageEvent = result.augmentedEvents.find((e) => e.type === 'damage')

    // Should have global modifier
    const globalModifier = damageEvent?.threat!.calculation.modifiers.find(
      (m: ThreatModifier) => m.name === 'Global Threat Modifier',
    )
    expect(globalModifier).toBeDefined()
    expect(globalModifier?.value).toBe(2.0)

    // Should also have class modifier
    const classModifier = damageEvent?.threat!.calculation.modifiers.find(
      (m: ThreatModifier) => m.name === 'Test Threat Up',
    )
    expect(classModifier).toBeDefined()
    expect(classModifier?.value).toBe(1.5)
  })

  it('should allow global auraModifiers to work for any class', () => {
    const GLOBAL_AURA_ID = 77777

    const customConfig: ThreatConfig = createMockThreatConfig({
      auraModifiers: {
        [GLOBAL_AURA_ID]: () => ({
          source: 'aura',
          name: 'Global Threat Modifier',
          value: 2.0,
        }),
      },
      classes: {
        priest: {
          baseThreatFactor: 1.0,
          auraModifiers: {},
          abilities: {},
        },
      },
    })

    const actorMap = new Map<number, Actor>([
      [priestActor.id, priestActor], // Priest, not warrior
    ])

    const events: WCLEvent[] = [
      // Apply global aura to priest
      createApplyBuffEvent({
        targetID: priestActor.id,
        abilityGameID: GLOBAL_AURA_ID,
      }),
      // Heal event from priest should get the global modifier
      createHealEvent({
        sourceID: priestActor.id,
        targetID: warriorActor.id,
        amount: 1000,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: customConfig,
    })

    const healEvent = result.augmentedEvents.find((e) => e.type === 'heal')
    const globalModifier = healEvent?.threat!.calculation.modifiers.find(
      (m: ThreatModifier) => m.name === 'Global Threat Modifier',
    )
    expect(globalModifier).toBeDefined()
    expect(globalModifier?.value).toBe(2.0)
  })
})

describe('Custom Threat Integration', () => {
  const CUSTOM_ABILITY_ID = 99999

  it('should apply customThreat modifications to threat tracker', () => {
    const customConfig: ThreatConfig = createMockThreatConfig({
      abilities: {
        [CUSTOM_ABILITY_ID]: () => ({
          formula: '0 (customThreat)',
          value: 0,
          splitAmongEnemies: false,
          effects: [
            {
              type: 'customThreat',
              changes: [
                {
                  sourceId: 2,
                  targetId: bossEnemy.id,
                  targetInstance: 0,
                  operator: 'add',
                  amount: 500,
                  total: 500,
                },
                {
                  sourceId: 3,
                  targetId: bossEnemy.id,
                  targetInstance: 0,
                  operator: 'add',
                  amount: 300,
                  total: 300,
                },
              ],
            },
          ],
        }),
      },
    })

    const actorMap = new Map<number, Actor>([
      [1, warriorActor],
      [2, priestActor],
      [3, { id: 3, name: 'DPS', class: 'rogue' }],
    ])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: 1,
        targetID: bossEnemy.id,
        abilityGameID: CUSTOM_ABILITY_ID,
        amount: 1000,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: customConfig,
    })

    expect(result.augmentedEvents).toHaveLength(1)

    const event = result.augmentedEvents[0]
    expect(event?.threat?.calculation.effects?.[0]?.type).toBe('customThreat')

    if (event?.threat?.calculation.effects?.[0]?.type === 'customThreat') {
      expect(event?.threat!.calculation.effects?.[0]?.changes).toHaveLength(2)
      expect(event?.threat!.calculation.effects?.[0]?.changes).toContainEqual({
        sourceId: 2,
        targetId: bossEnemy.id,
        targetInstance: 0,
        operator: 'add',
        amount: 500,
        total: 500,
      })
      expect(event?.threat!.calculation.effects?.[0]?.changes).toContainEqual({
        sourceId: 3,
        targetId: bossEnemy.id,
        targetInstance: 0,
        operator: 'add',
        amount: 300,
        total: 300,
      })
    }
  })

  it('should update positions when x/y fields are present', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      {
        ...createDamageEvent({
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          amount: 1000,
        }),
        x: 100,
        y: 200,
      } as WCLEvent & { x: number; y: number },
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    // Positions should be tracked internally
    expect(result.augmentedEvents).toHaveLength(1)
  })

  it('should handle events without customThreat', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 1000,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    expect(result.augmentedEvents).toHaveLength(1)

    const event = result.augmentedEvents[0]
    expect(event?.threat?.calculation.effects?.[0]).toBeUndefined()
  })

  it('should accumulate threat from both base and custom threat', () => {
    const customConfig: ThreatConfig = createMockThreatConfig({
      abilities: {
        [CUSTOM_ABILITY_ID]: () => ({
          formula: '100 (customThreat)',
          value: 100, // Base threat
          splitAmongEnemies: false,
          effects: [
            {
              type: 'customThreat',
              changes: [
                {
                  sourceId: 2,
                  targetId: bossEnemy.id,
                  targetInstance: 0,
                  operator: 'add',
                  amount: 500,
                  total: 500,
                },
              ],
            },
          ],
        }),
      },
    })

    const actorMap = new Map<number, Actor>([
      [1, warriorActor],
      [2, priestActor],
    ])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: 1,
        targetID: bossEnemy.id,
        abilityGameID: CUSTOM_ABILITY_ID,
        amount: 1000,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: customConfig,
    })

    const event = result.augmentedEvents[0]

    // Should have base threat from the ability
    expect(event?.threat?.calculation.baseThreat).toBe(100)

    // Should also have custom threat modifications
    expect(event?.threat?.calculation.effects?.[0]?.type).toBe('customThreat')
  })
})

describe('cumulative threat tracking', () => {
  it('includes cumulative threat values in augmented events', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    // Two damage events from the same actor to the same enemy
    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 500,
        timestamp: 1000,
      }),
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 300,
        timestamp: 2000,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    expect(result.augmentedEvents.length).toBe(2)

    const event1 = result.augmentedEvents[0]
    expect(event1?.threat!.changes?.[0]).toBeDefined()
    // 500 damage * 2 (base) * 1.3 (warrior class factor) = 1300
    expect(event1?.threat!.changes?.[0]?.amount).toBe(1300)
    expect(event1?.threat!.changes?.[0]?.total).toBe(1300) // First event, total = amount

    const event2 = result.augmentedEvents[1]
    expect(event2?.threat!.changes?.[0]).toBeDefined()
    // 300 damage * 2 (base) * 1.3 (warrior class factor) = 780
    expect(event2?.threat!.changes?.[0]?.amount).toBe(780)
    expect(event2?.threat!.changes?.[0]?.total).toBe(2080) // 1300 + 780
  })

  it('tracks cumulative threat separately per enemy', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const enemy1 = { id: 10, name: 'Boss 1', instance: 0 }
    const enemy2 = { id: 11, name: 'Boss 2', instance: 0 }

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: enemy1.id,
        amount: 100,
        timestamp: 1000,
      }),
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: enemy2.id,
        amount: 200,
        timestamp: 2000,
      }),
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: enemy1.id,
        amount: 150,
        timestamp: 3000,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies: [enemy1, enemy2],
      config: mockConfig,
    })

    expect(result.augmentedEvents.length).toBe(3)

    // Event 1: 100 to enemy1
    const event1 = result.augmentedEvents[0]
    expect(event1?.threat!.changes?.[0]?.targetId).toBe(enemy1.id)
    // 100 damage * 2 (base) * 1.3 (warrior class factor) = 260
    expect(event1?.threat!.changes?.[0]?.total).toBe(260)

    // Event 2: 200 to enemy2
    const event2 = result.augmentedEvents[1]
    expect(event2?.threat!.changes?.[0]?.targetId).toBe(enemy2.id)
    // 200 damage * 2 (base) * 1.3 (warrior class factor) = 520
    expect(event2?.threat!.changes?.[0]?.total).toBe(520)

    // Event 3: 150 to enemy1 again
    const event3 = result.augmentedEvents[2]
    expect(event3?.threat!.changes?.[0]?.targetId).toBe(enemy1.id)
    // 150 damage * 2 (base) * 1.3 (warrior class factor) = 390
    // Total for enemy1: 260 + 390 = 650
    expect(event3?.threat!.changes?.[0]?.total).toBe(650)
  })

  it('tracks cumulative threat separately per enemy instance', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const enemyInstanceOne = { id: 10, name: 'Boss', instance: 1 }
    const enemyInstanceTwo = { id: 10, name: 'Boss', instance: 2 }

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: 10,
        targetInstance: 1,
        amount: 100,
        timestamp: 1000,
      }),
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: 10,
        targetInstance: 2,
        amount: 200,
        timestamp: 2000,
      }),
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: 10,
        targetInstance: 1,
        amount: 150,
        timestamp: 3000,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies: [enemyInstanceOne, enemyInstanceTwo],
      config: mockConfig,
    })

    expect(result.augmentedEvents).toHaveLength(3)

    const first = result.augmentedEvents[0]?.threat!.changes?.[0]
    const second = result.augmentedEvents[1]?.threat!.changes?.[0]
    const third = result.augmentedEvents[2]?.threat!.changes?.[0]

    expect(first).toMatchObject({
      targetId: 10,
      targetInstance: 1,
      total: 260,
    })
    expect(second).toMatchObject({
      targetId: 10,
      targetInstance: 2,
      total: 520,
    })
    expect(third).toMatchObject({
      targetId: 10,
      targetInstance: 1,
      total: 650,
    })
  })

  it('updates cumulative threat after threat modifications', () => {
    const config = createMockThreatConfig({
      abilities: {
        [SPELLS.MOCK_ABILITY_1]: () => ({
          formula: '1 * amt',
          value: 100,
          splitAmongEnemies: false,
        }),
        [SPELLS.MOCK_ABILITY_2]: () => ({
          formula: 'threat * 0.5',
          value: 0,
          splitAmongEnemies: false,
          effects: [
            {
              type: 'modifyThreat',
              multiplier: 0.5,
              target: 'target',
            },
          ],
        }),
      },
    })

    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        abilityGameID: SPELLS.MOCK_ABILITY_1,
        amount: 100,
        timestamp: 1000,
      }),
      // Threat modification event (e.g., Fade)
      createCastEvent({
        sourceID: bossEnemy.id,
        targetID: warriorActor.id,
        abilityGameID: SPELLS.MOCK_ABILITY_2,
        timestamp: 2000,
      }),
      // Subsequent event to check cumulative threat
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        abilityGameID: SPELLS.MOCK_ABILITY_1,
        amount: 100,
        timestamp: 3000,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config,
    })

    expect(result.augmentedEvents.length).toBe(3)

    // After first event, cumulative is 100
    const event1 = result.augmentedEvents[0]
    expect(event1?.threat!.changes?.[0]?.total).toBe(100)

    // modifyThreat 0.5 * 100 = 50
    const event2 = result.augmentedEvents[1]
    expect(event2?.threat!.changes?.[0]?.total).toBe(50)

    // Event 2 is threat modification, verify next event starts from modified baseline
    // 100 * 0.5 = 50. Plus 100 from event 3 = 150.
    const event3 = result.augmentedEvents[2]
    expect(event3?.threat!.changes?.[0]?.total).toBe(150)
  })

  it('tracks cumulative threat for split-threat abilities', () => {
    const config = createMockThreatConfig({
      abilities: {
        [SPELLS.MOCK_ABILITY_1]: () => ({
          formula: '1 * amt',
          value: 100,
          splitAmongEnemies: true, // Splits among all enemies
        }),
      },
    })

    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const enemy1 = { id: 10, name: 'Enemy 1', instance: 0 }
    const enemy2 = { id: 11, name: 'Enemy 2', instance: 0 }

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: enemy1.id,
        abilityGameID: SPELLS.MOCK_ABILITY_1,
        amount: 100,
        timestamp: 1000,
      }),
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: enemy1.id,
        abilityGameID: SPELLS.MOCK_ABILITY_1,
        amount: 100,
        timestamp: 1001,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies: [enemy1, enemy2],
      config,
    })

    const event = result.augmentedEvents[0]
    expect(event?.threat!.changes).toEqual([
      expect.objectContaining({
        targetId: enemy1.id,
        amount: 50,
        total: 50,
      }),
      expect.objectContaining({
        targetId: enemy2.id,
        amount: 50,
        total: 50,
      }),
    ])

    const event2 = result.augmentedEvents[1]
    expect(event2?.threat!.changes).toEqual([
      expect.objectContaining({
        targetId: enemy1.id,
        amount: 50,
        total: 100,
      }),
      expect.objectContaining({
        targetId: enemy2.id,
        amount: 50,
        total: 100,
      }),
    ])
  })

  describe('environmental threat filtering', () => {
    it('calculates threat but applies no target changes when targeting environment (ID -1)', () => {
      const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])
      const events: WCLEvent[] = [
        createDamageEvent({
          sourceID: warriorActor.id,
          targetID: -1,
          amount: 1000,
        }),
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies,
        config: mockConfig,
      })

      expect(result.augmentedEvents.length).toBe(1)
      expect(result.augmentedEvents[0]?.threat?.changes).toBeUndefined()
      expect(result.augmentedEvents[0]?.threat?.calculation.formula).toBe(
        '(base) 2 * damage',
      )
    })

    it('applies configured ability effects even when targeting environment', () => {
      const actorMap = new Map<number, Actor>([
        [warriorActor.id, warriorActor],
        [bossEnemy.id, { id: bossEnemy.id, name: bossEnemy.name, class: null }],
      ])
      const events: WCLEvent[] = [
        createCastEvent({
          sourceID: bossEnemy.id,
          targetID: -1,
          abilityGameID: 28338,
        }),
      ]

      const config = createMockThreatConfig({
        abilities: {
          28338: () => ({
            formula: 'magneticPull(sourceMaxThreat)',
            value: 0,
            splitAmongEnemies: false,
            effects: [
              {
                type: 'customThreat',
                changes: [
                  {
                    sourceId: warriorActor.id,
                    targetId: bossEnemy.id,
                    targetInstance: 0,
                    operator: 'set',
                    amount: 1000,
                    total: 1000,
                  },
                ],
              },
            ],
          }),
        },
      })

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies,
        config,
      })

      expect(result.augmentedEvents).toHaveLength(1)
      expect(result.augmentedEvents[0]?.threat?.calculation.formula).toBe(
        'magneticPull(sourceMaxThreat)',
      )
      expect(result.augmentedEvents[0]?.threat?.changes).toEqual([
        {
          sourceId: warriorActor.id,
          targetId: bossEnemy.id,
          targetInstance: 0,
          operator: 'set',
          amount: 1000,
          total: 1000,
        },
      ])
    })

    it('excludes environment from split threat calculations', () => {
      const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

      const config = createMockThreatConfig({
        abilities: {
          [SPELLS.MOCK_ABILITY_1]: () => ({
            formula: '1 * amt',
            value: 100,
            splitAmongEnemies: true,
          }),
        },
      })

      const mixedEnemies = [
        bossEnemy,
        { id: -1, name: 'Environment', instance: 0 },
      ]

      const events: WCLEvent[] = [
        createDamageEvent({
          sourceID: warriorActor.id,
          targetID: bossEnemy.id,
          abilityGameID: SPELLS.MOCK_ABILITY_1,
          amount: 100,
        }),
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies: mixedEnemies,
        config,
      })

      const augmented = result.augmentedEvents[0]
      expect(augmented?.threat!.changes).toEqual([
        expect.objectContaining({ targetId: bossEnemy.id, amount: 100 }),
      ])
    })
  })
})

describe('ThreatChange Generation', () => {
  it('generates correct ThreatChange for standard damage event', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])
    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 1000,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: mockConfig,
    })

    const augmentedEvent = result.augmentedEvents[0]
    expect(augmentedEvent?.threat!.changes).toHaveLength(1)
    expect(augmentedEvent?.threat!.changes![0]).toMatchObject({
      sourceId: warriorActor.id,
      targetId: bossEnemy.id,
      operator: 'add',
      amount: 2600, // 1000 * 2 (base multiplier from mockConfig) * 1.3 (class)
      total: 2600,
    })
  })

  it('generates correct ThreatChange for modifyThreat (set) operation', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const specializedConfig = createMockThreatConfig({
      ...mockConfig,
      abilities: {
        [9999]: () => ({
          formula: 'modify',
          value: 0,
          splitAmongEnemies: false,
          modifiedThreat: 0,
          effects: [
            {
              type: 'modifyThreat',
              multiplier: 0.5,
              target: 'target',
            },
          ],
        }),
      },
    })

    const modifyEvent: WCLEvent = {
      ...createDamageEvent({
        sourceID: bossEnemy.id,
        targetID: warriorActor.id,
      }),
      abilityGameID: 9999,
      type: 'cast',
    }

    const sequence = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 1000,
      }),
      modifyEvent,
    ]

    const result = processEvents({
      rawEvents: sequence,
      actorMap,
      enemies,
      config: specializedConfig,
    })

    // First event (Damage): 1000 * 2 * 1.3 = 2600
    expect(result.augmentedEvents[0]?.threat!.changes?.[0]?.total).toBe(2600)

    // Second event (Modify): 2600 * 0.5 = 1300
    const modifyAugmented = result.augmentedEvents[1]
    expect(modifyAugmented?.threat!.changes).toHaveLength(1)
    expect(modifyAugmented?.threat!.changes![0]).toMatchObject({
      sourceId: warriorActor.id,
      targetId: bossEnemy.id,
      operator: 'set',
      amount: 1300,
      total: 1300,
    })
  })

  it('supports modifyThreat target=all by setting all actor threat on source enemy', () => {
    const actorMap = new Map<number, Actor>([
      [warriorActor.id, warriorActor],
      [priestActor.id, priestActor],
    ])

    const specializedConfig = createMockThreatConfig({
      ...mockConfig,
      abilities: {
        [7777]: () => ({
          formula: 'wipe all',
          value: 0,
          splitAmongEnemies: false,
          effects: [
            {
              type: 'modifyThreat',
              multiplier: 0,
              target: 'all',
            },
          ],
        }),
      },
    })

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
      createDamageEvent({
        sourceID: priestActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
      createDamageEvent({
        sourceID: bossEnemy.id,
        targetID: warriorActor.id,
        abilityGameID: 7777,
        amount: 0,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies,
      config: specializedConfig,
    })

    const wipeEvent = result.augmentedEvents[2]
    expect(wipeEvent?.threat!.changes).toHaveLength(2)
    expect(wipeEvent?.threat!.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: warriorActor.id,
          targetId: bossEnemy.id,
          operator: 'set',
          total: 0,
        }),
        expect.objectContaining({
          sourceId: priestActor.id,
          targetId: bossEnemy.id,
          operator: 'set',
          total: 0,
        }),
      ]),
    )
  })

  it('supports modifyThreat target=all for a specific source enemy instance', () => {
    const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

    const bossInstanceOne: Enemy = {
      id: bossEnemy.id,
      name: 'Boss',
      instance: 1,
    }
    const bossInstanceTwo: Enemy = {
      id: bossEnemy.id,
      name: 'Boss',
      instance: 2,
    }

    const specializedConfig = createMockThreatConfig({
      ...mockConfig,
      abilities: {
        [7777]: () => ({
          formula: 'wipe all',
          value: 0,
          splitAmongEnemies: false,
          effects: [
            {
              type: 'modifyThreat',
              multiplier: 0,
              target: 'all',
            },
          ],
        }),
      },
    })

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        targetInstance: 1,
        amount: 100,
        timestamp: 1000,
      }),
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        targetInstance: 2,
        amount: 200,
        timestamp: 2000,
      }),
      createDamageEvent({
        sourceID: bossEnemy.id,
        sourceInstance: 1,
        targetID: warriorActor.id,
        abilityGameID: 7777,
        amount: 0,
        timestamp: 2500,
      }),
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        targetInstance: 2,
        amount: 100,
        timestamp: 3000,
      }),
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies: [bossInstanceOne, bossInstanceTwo],
      config: specializedConfig,
    })

    const wipeEvent = result.augmentedEvents[2]
    expect(wipeEvent?.threat!.changes).toEqual([
      expect.objectContaining({
        sourceId: warriorActor.id,
        targetId: bossEnemy.id,
        targetInstance: 1,
        operator: 'set',
        total: 0,
      }),
    ])

    const postWipe = result.augmentedEvents[3]?.threat!.changes?.[0]
    expect(postWipe).toMatchObject({
      targetId: bossEnemy.id,
      targetInstance: 2,
      total: 780,
    })
  })

  it('supports modifyThreat target=all from friendly source by setting actor threat on all enemies', () => {
    const actorMap = new Map<number, Actor>([
      [warriorActor.id, warriorActor],
      [priestActor.id, priestActor],
    ])

    const enemy2: Enemy = { id: 555, name: 'Boss 2', instance: 0 }

    const specializedConfig = createMockThreatConfig({
      ...mockConfig,
      abilities: {
        [8887]: () => ({
          formula: 'wipe self all enemies',
          value: 0,
          splitAmongEnemies: false,
          effects: [
            {
              type: 'modifyThreat',
              multiplier: 0,
              target: 'all',
            },
          ],
        }),
      },
    })

    const events: WCLEvent[] = [
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      }),
      createDamageEvent({
        sourceID: warriorActor.id,
        targetID: enemy2.id,
        amount: 100,
      }),
      {
        ...createDamageEvent({
          sourceID: warriorActor.id,
          targetID: warriorActor.id,
          amount: 0,
        }),
        type: 'cast',
        sourceIsFriendly: true,
        targetIsFriendly: true,
        abilityGameID: 8887,
      },
    ]

    const result = processEvents({
      rawEvents: events,
      actorMap,
      enemies: [bossEnemy, enemy2],
      config: specializedConfig,
    })

    const wipeEvent = result.augmentedEvents[2]
    expect(wipeEvent?.threat!.changes).toHaveLength(2)
    expect(wipeEvent?.threat!.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: warriorActor.id,
          targetId: bossEnemy.id,
          operator: 'set',
          total: 0,
        }),
        expect.objectContaining({
          sourceId: warriorActor.id,
          targetId: enemy2.id,
          operator: 'set',
          total: 0,
        }),
      ]),
    )
  })

  it('generates multiple ThreatChanges for customThreat operation', () => {
    const customAbilityId = 8888
    const specializedConfig = createMockThreatConfig({
      ...mockConfig,
      abilities: {
        [customAbilityId]: () => ({
          formula: 'custom',
          value: 0,
          splitAmongEnemies: false,
          modifiedThreat: 0,
          effects: [
            {
              type: 'customThreat',
              changes: [
                {
                  sourceId: warriorActor.id,
                  targetId: bossEnemy.id,
                  targetInstance: 0,
                  operator: 'add',
                  amount: 500,
                  total: 500,
                },
                {
                  sourceId: priestActor.id,
                  targetId: bossEnemy.id,
                  targetInstance: 0,
                  operator: 'add',
                  amount: 300,
                  total: 300,
                },
              ],
            },
          ],
        }),
      },
    })

    const actorMap = new Map<number, Actor>([
      [warriorActor.id, warriorActor],
      [priestActor.id, priestActor],
    ])

    const event: WCLEvent = {
      ...createDamageEvent({
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
      }),
      abilityGameID: customAbilityId,
      type: 'cast',
    }

    const result = processEvents({
      rawEvents: [event],
      actorMap,
      enemies,
      config: specializedConfig,
    })

    const augmented = result.augmentedEvents[0]
    expect(augmented?.threat!.changes).toHaveLength(2)
    expect(augmented?.threat!.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: warriorActor.id,
          targetId: bossEnemy.id,
          operator: 'add',
          amount: 500,
          total: 500,
        }),
        expect.objectContaining({
          sourceId: priestActor.id,
          targetId: bossEnemy.id,
          operator: 'add',
          amount: 300,
          total: 300,
        }),
      ]),
    )
  })
})

describe('Event Interceptor Integration', () => {
  describe('installInterceptor special type', () => {
    it('installs a handler that runs on subsequent events', () => {
      const hunterActor: Actor = { id: 5, name: 'Hunter', class: 'hunter' }
      const actorMap = new Map([[hunterActor.id, hunterActor]])

      const INSTALL_SPELL = 99999
      const mockHandler = vi.fn(() => ({
        action: 'passthrough',
      })) as EventInterceptor

      const config = createMockThreatConfig({
        abilities: {
          [INSTALL_SPELL]: () => ({
            formula: '0',
            value: 0,
            splitAmongEnemies: false,
            effects: [
              {
                type: 'installInterceptor',
                interceptor: mockHandler,
              },
            ],
          }),
        },
      })

      const events: WCLEvent[] = [
        {
          timestamp: 1000,
          type: 'cast',
          sourceID: hunterActor.id,
          sourceIsFriendly: true,
          targetID: hunterActor.id,
          targetIsFriendly: true,
          abilityGameID: INSTALL_SPELL,
        },
        createDamageEvent({
          timestamp: 2000,
          sourceID: hunterActor.id,
          targetID: bossEnemy.id,
          amount: 500,
        }),
      ]

      processEvents({
        rawEvents: events,
        actorMap,
        enemies: [bossEnemy],
        config,
      })

      // Handler should be called with the damage event
      expect(mockHandler).toHaveBeenCalled()
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'damage',
          timestamp: 2000,
          sourceID: hunterActor.id,
        }),
        expect.any(Object), // EventInterceptorContext
      )
    })

    it('passthrough action yields augmented event without modification', () => {
      const hunterActor: Actor = { id: 5, name: 'Hunter', class: 'hunter' }
      const actorMap = new Map([[hunterActor.id, hunterActor]])

      const PASSTHROUGH_SPELL = 88888
      const mockHandler = vi.fn(() => ({
        action: 'passthrough',
      })) as EventInterceptor

      const config = createMockThreatConfig({
        abilities: {
          [PASSTHROUGH_SPELL]: () => ({
            formula: '0',
            value: 0,
            splitAmongEnemies: false,
            effects: [
              {
                type: 'installInterceptor',
                interceptor: mockHandler,
              },
            ],
          }),
        },
      })

      const damageEvent = createDamageEvent({
        timestamp: 2000,
        sourceID: hunterActor.id,
        targetID: bossEnemy.id,
        amount: 500,
      })

      const events: WCLEvent[] = [
        {
          timestamp: 1000,
          type: 'cast',
          sourceID: hunterActor.id,
          sourceIsFriendly: true,
          targetID: hunterActor.id,
          targetIsFriendly: true,
          abilityGameID: PASSTHROUGH_SPELL,
        },
        damageEvent,
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies: [bossEnemy],
        config,
      })

      // Second event: damage should be processed normally
      const damageAugmented = result.augmentedEvents[1]
      expect(damageAugmented?.threat!.changes).toHaveLength(1)
      // Default mock config is 1:1 damage threat
      expect(damageAugmented?.threat!.changes?.[0]).toMatchObject({
        sourceId: hunterActor.id,
        targetId: bossEnemy.id,
        amount: 500,
        operator: 'add',
      })

      // Handler should have been called for the damage event
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'damage',
          sourceID: hunterActor.id,
        }),
        expect.any(Object),
      )
    })
  })

  describe('threatRecipientOverride', () => {
    describe('negative threat deltas', () => {
      const NEGATIVE_THREAT_SPELL = 99991

      const negativeThreatConfig = createMockThreatConfig({
        abilities: {
          [NEGATIVE_THREAT_SPELL]: () => ({
            formula: '-300',
            value: -300,
            splitAmongEnemies: false,
          }),
        },
      })

      it('reduces existing threat for the target enemy', () => {
        const warriorActor: Actor = {
          id: 11,
          name: 'WarriorOne',
          class: 'warrior',
        }
        const actorMap = new Map([[warriorActor.id, warriorActor]])

        const events: WCLEvent[] = [
          createDamageEvent({
            timestamp: 1000,
            sourceID: warriorActor.id,
            targetID: bossEnemy.id,
            amount: 500,
          }),
          createDamageEvent({
            timestamp: 2000,
            sourceID: warriorActor.id,
            targetID: bossEnemy.id,
            amount: 1,
            abilityGameID: NEGATIVE_THREAT_SPELL,
          }),
        ]

        const result = processEvents({
          rawEvents: events,
          actorMap,
          enemies: [bossEnemy],
          config: negativeThreatConfig,
        })

        const reductionEvent = result.augmentedEvents[1]
        expect(reductionEvent?.threat!.calculation.modifiedThreat).toBe(-300)
        expect(reductionEvent?.threat!.changes).toHaveLength(1)
        expect(reductionEvent?.threat!.changes?.[0]).toMatchObject({
          sourceId: warriorActor.id,
          targetId: bossEnemy.id,
          operator: 'add',
          amount: -300,
          total: 200,
        })
      })

      it('floors resulting threat at zero when reduction exceeds current threat', () => {
        const warriorActor: Actor = {
          id: 12,
          name: 'WarriorTwo',
          class: 'warrior',
        }
        const actorMap = new Map([[warriorActor.id, warriorActor]])

        const events: WCLEvent[] = [
          createDamageEvent({
            timestamp: 1000,
            sourceID: warriorActor.id,
            targetID: bossEnemy.id,
            amount: 200,
          }),
          createDamageEvent({
            timestamp: 2000,
            sourceID: warriorActor.id,
            targetID: bossEnemy.id,
            amount: 1,
            abilityGameID: NEGATIVE_THREAT_SPELL,
          }),
        ]

        const result = processEvents({
          rawEvents: events,
          actorMap,
          enemies: [bossEnemy],
          config: negativeThreatConfig,
        })

        const reductionEvent = result.augmentedEvents[1]
        expect(reductionEvent?.threat!.changes).toHaveLength(1)
        expect(reductionEvent?.threat!.changes?.[0]).toMatchObject({
          sourceId: warriorActor.id,
          targetId: bossEnemy.id,
          operator: 'add',
          amount: -200,
          total: 0,
        })
      })

      it('does not emit a change when reducing threat at zero', () => {
        const warriorActor: Actor = {
          id: 13,
          name: 'WarriorThree',
          class: 'warrior',
        }
        const actorMap = new Map([[warriorActor.id, warriorActor]])

        const events: WCLEvent[] = [
          createDamageEvent({
            timestamp: 1000,
            sourceID: warriorActor.id,
            targetID: bossEnemy.id,
            amount: 1,
            abilityGameID: NEGATIVE_THREAT_SPELL,
          }),
        ]

        const result = processEvents({
          rawEvents: events,
          actorMap,
          enemies: [bossEnemy],
          config: negativeThreatConfig,
        })

        const reductionEvent = result.augmentedEvents[0]
        expect(reductionEvent?.threat!.calculation.modifiedThreat).toBe(-300)
        expect(reductionEvent?.threat!.changes).toBeUndefined()
      })
    })

    it('redirects threat to a different actor', () => {
      const hunterActor: Actor = { id: 5, name: 'Hunter', class: 'hunter' }
      const tankActor: Actor = { id: 10, name: 'Tank', class: 'warrior' }
      const actorMap = new Map([
        [hunterActor.id, hunterActor],
        [tankActor.id, tankActor],
      ])

      const MISDIRECTION_SPELL = 34477

      const config = createMockThreatConfig({
        abilities: {
          [MISDIRECTION_SPELL]: () => ({
            formula: '0',
            value: 0,
            splitAmongEnemies: false,
            effects: [
              {
                type: 'installInterceptor',
                interceptor: (event, ctx) => {
                  // Only redirect hunter's damage
                  if (
                    event.type !== 'damage' ||
                    event.sourceID !== hunterActor.id
                  ) {
                    return { action: 'passthrough' }
                  }

                  ctx.uninstall()
                  return {
                    action: 'augment',
                    threatRecipientOverride: tankActor.id,
                  }
                },
              },
            ],
          }),
        },
      })

      const events: WCLEvent[] = [
        // Hunter casts Misdirection on tank
        {
          timestamp: 1000,
          type: 'cast',
          sourceID: hunterActor.id,
          sourceIsFriendly: true,
          targetID: tankActor.id,
          targetIsFriendly: true,
          abilityGameID: MISDIRECTION_SPELL,
        },
        // Hunter deals damage
        createDamageEvent({
          timestamp: 2000,
          sourceID: hunterActor.id,
          targetID: bossEnemy.id,
          amount: 500,
        }),
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies: [bossEnemy],
        config,
      })

      // First event: Misdirection cast (no threat changes)
      const misdirectionEvent = result.augmentedEvents[0]
      expect(misdirectionEvent?.threat!.calculation.effects?.[0]?.type).toBe(
        'installInterceptor',
      )

      // Second event: Damage threat goes to tank, not hunter
      const damageEvent = result.augmentedEvents[1]
      expect(damageEvent?.threat!.changes).toHaveLength(1)
      expect(damageEvent?.threat!.changes?.[0]).toMatchObject({
        sourceId: tankActor.id, // Threat attributed to tank
        targetId: bossEnemy.id,
        operator: 'add',
      })
      // Base threat: 500 (mockConfig default is 1:1)
      expect(damageEvent?.threat!.changes?.[0]?.amount).toBe(500)
    })

    it('redirects split threat correctly', () => {
      const priestActor: Actor = { id: 2, name: 'Priest', class: 'priest' }
      const tankActor: Actor = { id: 10, name: 'Tank', class: 'warrior' }
      const actorMap = new Map([
        [priestActor.id, priestActor],
        [tankActor.id, tankActor],
      ])

      const REDIRECT_SPELL = 88888

      const config = createMockThreatConfig({
        abilities: {
          [REDIRECT_SPELL]: () => ({
            formula: '0',
            value: 0,
            splitAmongEnemies: false,
            effects: [
              {
                type: 'installInterceptor',
                interceptor: (event, ctx) => {
                  if (
                    event.type !== 'heal' ||
                    event.sourceID !== priestActor.id
                  ) {
                    return { action: 'passthrough' }
                  }

                  ctx.uninstall()
                  return {
                    action: 'augment',
                    threatRecipientOverride: tankActor.id,
                  }
                },
              },
            ],
          }),
        },
      })

      const events: WCLEvent[] = [
        {
          timestamp: 1000,
          type: 'cast',
          sourceID: priestActor.id,
          sourceIsFriendly: true,
          targetID: tankActor.id,
          targetIsFriendly: true,
          abilityGameID: REDIRECT_SPELL,
        },
        createHealEvent({
          timestamp: 2000,
          sourceID: priestActor.id,
          targetID: priestActor.id,
          amount: 1000,
        }),
      ]

      const enemies: Enemy[] = [bossEnemy, addEnemy]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies,
        config,
      })

      const healEvent = result.augmentedEvents[1]
      // Heal is split among 2 enemies
      expect(healEvent?.threat!.changes).toHaveLength(2)

      // Both threat changes should be attributed to tank
      for (const change of healEvent?.threat!.changes ?? []) {
        expect(change.sourceId).toBe(tankActor.id)
      }
    })
  })

  describe('skip action', () => {
    it('suppresses threat generation for intercepted events', () => {
      const hunterActor: Actor = { id: 5, name: 'Hunter', class: 'hunter' }
      const actorMap = new Map([[hunterActor.id, hunterActor]])

      const NO_THREAT_SPELL = 77777

      const config = createMockThreatConfig({
        abilities: {
          [NO_THREAT_SPELL]: () => ({
            formula: '0',
            value: 0,
            splitAmongEnemies: false,
            effects: [
              {
                type: 'installInterceptor',
                interceptor: (event, ctx) => {
                  const elapsed = ctx.timestamp - ctx.installedAt

                  // Suppress threat for 5 seconds
                  if (elapsed > 5000) {
                    ctx.uninstall()
                    return { action: 'passthrough' }
                  }

                  if (event.sourceID === hunterActor.id) {
                    return { action: 'skip' }
                  }

                  return { action: 'passthrough' }
                },
              },
            ],
          }),
        },
      })

      const events: WCLEvent[] = [
        {
          timestamp: 1000,
          type: 'cast',
          sourceID: hunterActor.id,
          sourceIsFriendly: true,
          targetID: hunterActor.id,
          targetIsFriendly: true,
          abilityGameID: NO_THREAT_SPELL,
        },
        // Damage within window - should be suppressed
        createDamageEvent({
          timestamp: 3000,
          sourceID: hunterActor.id,
          targetID: bossEnemy.id,
          amount: 500,
        }),
        // Damage after window - should generate threat
        createDamageEvent({
          timestamp: 7000,
          sourceID: hunterActor.id,
          targetID: bossEnemy.id,
          amount: 500,
        }),
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies: [bossEnemy],
        config,
      })

      // Second event: suppressed
      const suppressedEvent = result.augmentedEvents[1]
      expect(suppressedEvent?.threat!.calculation.modifiedThreat).toBe(0)
      expect(suppressedEvent?.threat!.calculation.formula).toBe(
        '0 (suppressed by effect)',
      )
      expect(suppressedEvent?.threat!.changes).toEqual([])

      // Third event: normal threat
      const normalEvent = result.augmentedEvents[2]
      expect(normalEvent?.threat!.calculation.modifiedThreat).toBe(500)
      expect(normalEvent?.threat!.changes).toHaveLength(1)
      expect(normalEvent?.threat!.changes?.[0]).toMatchObject({
        sourceId: hunterActor.id,
        targetId: bossEnemy.id,
        amount: 500,
      })
    })
  })

  describe('handler context', () => {
    it('provides access to fight state via actors context', () => {
      const warriorActor: Actor = { id: 1, name: 'Warrior', class: 'warrior' }
      const actorMap = new Map([[warriorActor.id, warriorActor]])

      const TEST_SPELL = 55555

      const mockHandler = vi.fn((event, ctx) => {
        // Verify we can access fight state
        expect(ctx.actors).toBeDefined()
        // These methods should exist and be callable
        const runtimeActor = ctx.actors.getActor?.({ id: 1 })
        expect(runtimeActor?.name).toBe('Warrior')
        ctx.actors.getThreat(1, { id: 99 })
        ctx.actors.getPosition({ id: 1 })
        ctx.uninstall()
        return { action: 'passthrough' }
      }) as EventInterceptor

      const config = createMockThreatConfig({
        abilities: {
          [TEST_SPELL]: () => ({
            formula: '0',
            value: 0,
            splitAmongEnemies: false,
            effects: [
              {
                type: 'installInterceptor',
                interceptor: mockHandler,
              },
            ],
          }),
        },
      })

      const damageEvent = createDamageEvent({
        timestamp: 2000,
        sourceID: warriorActor.id,
        targetID: bossEnemy.id,
        amount: 100,
      })

      const events: WCLEvent[] = [
        {
          timestamp: 1000,
          type: 'cast',
          sourceID: warriorActor.id,
          sourceIsFriendly: true,
          targetID: warriorActor.id,
          targetIsFriendly: true,
          abilityGameID: TEST_SPELL,
        },
        damageEvent,
      ]

      processEvents({
        rawEvents: events,
        actorMap,
        enemies: [bossEnemy],
        config,
      })

      // Verify the handler was called with the damage event and context
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'damage',
          timestamp: 2000,
          sourceID: warriorActor.id,
        }),
        expect.objectContaining({
          timestamp: 2000,
          actors: expect.any(Object),
          uninstall: expect.any(Function),
        }),
      )
    })
  })
})
