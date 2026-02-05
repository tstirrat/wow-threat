/**
 * Threat Engine Tests
 *
 * Unit tests for the threat engine that processes raw WCL events and calculates
 * threat. Uses mock configs to test behaviors surgically without dependencies on
 * real config evolution.
 */

import { describe, it, expect } from 'vitest'
import type {
  WCLEvent,
  GearItem,
  DamageEvent,
  HealEvent,
  ApplyBuffEvent,
  RemoveBuffEvent,
} from '@wcl-threat/wcl-types'
import type {
  Actor,
  Enemy,
  ThreatConfig,
  ThreatContext,
  ThreatModifier,
} from '@wcl-threat/threat-config'
import { processEvents } from './threat-engine'
import { createMockThreatConfig } from '../../test/helpers/config'
import {
  createDamageEvent,
  createHealEvent,
  createApplyBuffEvent,
  createRemoveBuffEvent,
  createCombatantInfoAura,
} from '../../test/helpers/events'

// Test fixtures
const warriorActor: Actor = { id: 1, name: 'WarriorTank', class: 'warrior' }
const priestActor: Actor = { id: 2, name: 'PriestHealer', class: 'priest' }
const unknownActor: Actor = { id: 99, name: 'Unknown', class: null }

const bossEnemy: Enemy = { id: 99, name: 'Boss', instance: 0 }
const addEnemy: Enemy = { id: 26, name: 'Add', instance: 0 }

const enemies: Enemy[] = [bossEnemy, addEnemy]

// Spell IDs for testing
const SPELLS = {
  // Stances
  DEFENSIVE_STANCE: 71,
  BATTLE_STANCE: 2457,
  BERSERKER_STANCE: 2458,
  // Abilities
  MOCK_ABILITY_1: 1001,
  MOCK_ABILITY_2: 1002,
  // Auras
  MOCK_AURA_THREAT_UP: 2001,
  MOCK_AURA_THREAT_DOWN: 2002,
  // Set bonus
  SET_BONUS_AURA: 3001,
} as const

/**
 * Create mock config with custom base threat formulas and warrior/priest configs
 */
const mockConfig = createMockThreatConfig({
  baseThreat: {
    damage: (ctx: ThreatContext) => ({
      formula: '2 * damage',
      value: ctx.amount * 2,
      splitAmongEnemies: false,
    }),
    heal: (ctx: ThreatContext) => ({
      formula: '0.5 * heal',
      value: ctx.amount * 0.5,
      splitAmongEnemies: false,
    }),
    energize: (ctx: ThreatContext) => ({
      formula: '0.5 * resourceChange',
      value: ctx.amount * 0.5,
      splitAmongEnemies: false,
    }),
  },

  classes: {
    warrior: {
      exclusiveAuras: [new Set([SPELLS.DEFENSIVE_STANCE, SPELLS.BATTLE_STANCE, SPELLS.BERSERKER_STANCE])],
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
      },

      abilities: {
        // Mock ability with custom formula
        [SPELLS.MOCK_ABILITY_1]: (ctx: ThreatContext) => ({
          formula: '1 * amt + 100',
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
    // rogue from default is included
  },
})

describe('processEvents', () => {
  describe('event counting', () => {
    it('counts event types correctly', () => {
      const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

      const events: WCLEvent[] = [
        createDamageEvent({ sourceID: warriorActor.id, targetID: bossEnemy.id }),
        createDamageEvent({ sourceID: warriorActor.id, targetID: bossEnemy.id }),
        createHealEvent({ sourceID: warriorActor.id, targetID: warriorActor.id }),
        createApplyBuffEvent({ 
          targetID: warriorActor.id, 
          abilityGameID: SPELLS.DEFENSIVE_STANCE
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
    })
  })

  describe('combatantinfo processing', () => {
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
      expect(result.augmentedEvents.length).toBe(1)
      expect(result.eventCounts.combatantinfo).toBe(1)

      // The damage event should have the aura modifier from combatantinfo
      const damageEvent = result.augmentedEvents[0]
      const threatUpModifier = damageEvent.threat.calculation.modifiers.find(
        (m: ThreatModifier) => m.name === 'Test Threat Up'
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
        createDamageEvent({ sourceID: warriorActor.id, targetID: bossEnemy.id, amount: 100 }),
      ]

      const result = processEvents({
        rawEvents: events,
        actorMap,
        enemies,
        config: mockConfig,
      })

      // Damage event should be present with the synthetic aura modifier
      expect(result.augmentedEvents.length).toBe(1)
      const damageEvent = result.augmentedEvents[0]
      const setBonusModifier = damageEvent.threat.calculation.modifiers.find(
        (m: ThreatModifier) => m.source === 'gear'
      )
      expect(setBonusModifier).toBeDefined()
      expect(setBonusModifier?.value).toBe(0.8)
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
        auras: [createCombatantInfoAura(SPELLS.DEFENSIVE_STANCE, 'Defensive Stance', 99)],
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

      // Both damage events should be present
      expect(result.augmentedEvents.length).toBe(2)

      // First event should have the threat up modifier (1.5x)
      const firstEvent = result.augmentedEvents[0]
      expect(firstEvent.threat).toBeDefined()
      const firstThreatUpModifier = firstEvent.threat.calculation.modifiers.find(
        (m: ThreatModifier) => m.name === 'Test Threat Up'
      )
      expect(firstThreatUpModifier).toBeDefined()
      expect(firstThreatUpModifier?.value).toBe(1.5)

      // Second event should not have the threat up modifier
      const secondEvent = result.augmentedEvents[1]
      const secondThreatUpModifier = secondEvent.threat.calculation.modifiers.find(
        (m: ThreatModifier) => m.name === 'Test Threat Up'
      )
      expect(secondThreatUpModifier).toBeUndefined()
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
          auras: [createCombatantInfoAura(SPELLS.MOCK_AURA_THREAT_UP, 'Test Threat Up')],
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

      const damageEvent = result.augmentedEvents[0]
      expect(damageEvent.threat).toBeDefined()

      // Check for the threat up modifier
      const threatUpModifier = damageEvent.threat.calculation.modifiers.find(
        (m: ThreatModifier) => m.name === 'Test Threat Up'
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

      const damageEvent = result.augmentedEvents[0]
      const classModifier = damageEvent.threat.calculation.modifiers.find(
        (m: ThreatModifier) => m.source === 'class'
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
      expect(augmented.threat.calculation.baseThreat).toBe(300)
      expect(augmented.threat.calculation.formula).toBe('1 * amt + 100')
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
      // Should have threat values for both enemies
      expect(augmented.threat.values.length).toBe(2)
      expect(augmented.threat.calculation.isSplit).toBe(true)
      // Calculation: 200 * 0.5 = 100 base, class factor 1.3x = 130, split among 2 enemies = 65 each
      expect(augmented.threat.values[0].amount).toBe(65)
      expect(augmented.threat.values[1].amount).toBe(65)
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
      expect(augmented.type).toBe('damage')
      expect(augmented.threat).toBeDefined()
      expect(augmented.threat.values).toBeDefined()
      expect(augmented.threat.calculation).toBeDefined()
      // Base formula: 2 * 500 = 1000
      expect(augmented.threat.calculation.baseThreat).toBe(1000)
      expect(augmented.threat.calculation.formula).toBe('2 * damage')
    })

    it('calculates threat for heal events using base formula', () => {
      const actorMap = new Map<number, Actor>([[priestActor.id, priestActor]])

      const events: WCLEvent[] = [
        createHealEvent({
          sourceID: priestActor.id,
          targetID: warriorActor.id,
          amount: 1000,
          overheal: 200,
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
      expect(augmented.type).toBe('heal')
      expect(augmented.threat).toBeDefined()
      expect(augmented.threat.values).toBeDefined()
      // Effective heal: 1000 - 200 overheal = 800, formula: 0.5 * 800 = 400
      expect(augmented.threat.calculation.baseThreat).toBe(400)
    })

    it('calculates threat to specific enemy when targeting hostile', () => {
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
      expect(augmented.threat.values.length).toBe(1)
      expect(augmented.threat.values[0].id).toBe(bossEnemy.id)
    })

    it('generates zero threat to enemies when target is friendly', () => {
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

      // Damage to friendly targets is filtered out of augmented events
      expect(result.augmentedEvents.length).toBe(0)
    })
  })

  describe('augmented event structure', () => {
    it('includes all event fields in augmented output', () => {
      const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

      const damageEvent: DamageEvent = {
        timestamp: 1000,
        type: 'damage',
        sourceID: warriorActor.id,
        sourceIsFriendly: true,
        targetID: bossEnemy.id,
        targetIsFriendly: false,
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
      expect(augmented.timestamp).toBe(1000)
      expect(augmented.type).toBe('damage')
      expect(augmented.sourceID).toBe(warriorActor.id)
      expect(augmented.targetID).toBe(bossEnemy.id)
      expect(augmented.sourceInstance).toBe(1)
      expect(augmented.targetInstance).toBe(2)
      expect(augmented.abilityGameID).toBe(SPELLS.MOCK_ABILITY_1)
      expect(augmented.amount).toBe(2500)
      expect(augmented.absorbed).toBe(100)
      expect(augmented.blocked).toBe(200)
      expect(augmented.mitigated).toBe(50)
      expect(augmented.hitType).toBe('hit')
      expect(augmented.tick).toBe(false)
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
      expect(augmented.threat.calculation.formula).toBeDefined()
      expect(augmented.threat.calculation.amount).toBe(1000)
      expect(augmented.threat.calculation.baseThreat).toBeGreaterThan(0)
      expect(augmented.threat.calculation.modifiedThreat).toBeGreaterThan(0)
      expect(augmented.threat.calculation.modifiers).toBeDefined()
      expect(Array.isArray(augmented.threat.calculation.modifiers)).toBe(true)
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
      expect(augmented1.threat.calculation.baseThreat).toBe(200)
      expect(augmented1.threat.calculation.formula).toBe('class: 2 * amt')

      // Second event: class-only formula (3x)
      const augmented2 = result.augmentedEvents[1]
      expect(augmented2.threat.calculation.baseThreat).toBe(300)
      expect(augmented2.threat.calculation.formula).toBe('class-only: 3 * amt')
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

      const damageEvent = result.augmentedEvents[0]
      const globalModifier = damageEvent.threat.calculation.modifiers.find(
        (m: ThreatModifier) => m.name === 'Global Threat Modifier'
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

      const damageEvent = result.augmentedEvents[0]
      
      // Should have global modifier
      const globalModifier = damageEvent.threat.calculation.modifiers.find(
        (m: ThreatModifier) => m.name === 'Global Threat Modifier'
      )
      expect(globalModifier).toBeDefined()
      expect(globalModifier?.value).toBe(2.0)

      // Should also have class modifier
      const classModifier = damageEvent.threat.calculation.modifiers.find(
        (m: ThreatModifier) => m.name === 'Test Threat Up'
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

      const healEvent = result.augmentedEvents[0]
      const globalModifier = healEvent.threat.calculation.modifiers.find(
        (m: ThreatModifier) => m.name === 'Global Threat Modifier'
      )
      expect(globalModifier).toBeDefined()
      expect(globalModifier?.value).toBe(2.0)
    })
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
          special: {
            type: 'customThreat',
            modifications: [
              { actorId: 2, enemyId: bossEnemy.id, amount: 500 },
              { actorId: 3, enemyId: bossEnemy.id, amount: 300 },
            ],
          },
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
    expect(event.threat?.calculation.special?.type).toBe('customThreat')

    if (event.threat?.calculation.special?.type === 'customThreat') {
      expect(event.threat.calculation.special.modifications).toHaveLength(2)
      expect(event.threat.calculation.special.modifications).toContainEqual({
        actorId: 2,
        enemyId: bossEnemy.id,
        amount: 500,
      })
      expect(event.threat.calculation.special.modifications).toContainEqual({
        actorId: 3,
        enemyId: bossEnemy.id,
        amount: 300,
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
      } as any,
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
    expect(event.threat?.calculation.special).toBeUndefined()
  })

  it('should accumulate threat from both base and custom threat', () => {
    const customConfig: ThreatConfig = createMockThreatConfig({
      abilities: {
        [CUSTOM_ABILITY_ID]: () => ({
          formula: '100 (customThreat)',
          value: 100, // Base threat
          splitAmongEnemies: false,
          special: {
            type: 'customThreat',
            modifications: [
              { actorId: 2, enemyId: bossEnemy.id, amount: 500 },
            ],
          },
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
     expect(event.threat?.calculation.baseThreat).toBe(100)
     
     // Should also have custom threat modifications
     expect(event.threat?.calculation.special?.type).toBe('customThreat')
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
     expect(event1.threat.values[0]).toBeDefined()
     // 500 damage * 2 (base) * 1.3 (warrior class factor) = 1300
     expect(event1.threat.values[0].amount).toBe(1300)
     expect(event1.threat.values[0].cumulative).toBe(1300) // First event, cumulative = amount

     const event2 = result.augmentedEvents[1]
     expect(event2.threat.values[0]).toBeDefined()
     // 300 damage * 2 (base) * 1.3 (warrior class factor) = 780
     expect(event2.threat.values[0].amount).toBe(780)
     expect(event2.threat.values[0].cumulative).toBe(2080) // 1300 + 780
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
      expect(event1.threat.values[0].id).toBe(enemy1.id)
      // 100 damage * 2 (base) * 1.3 (warrior class factor) = 260
      expect(event1.threat.values[0].cumulative).toBe(260)

      // Event 2: 200 to enemy2
      const event2 = result.augmentedEvents[1]
      expect(event2.threat.values[0].id).toBe(enemy2.id)
      // 200 damage * 2 (base) * 1.3 (warrior class factor) = 520
      expect(event2.threat.values[0].cumulative).toBe(520)

      // Event 3: 150 to enemy1 again
      const event3 = result.augmentedEvents[2]
      expect(event3.threat.values[0].id).toBe(enemy1.id)
      // 150 damage * 2 (base) * 1.3 (warrior class factor) = 390
      // Total for enemy1: 260 + 390 = 650
      expect(event3.threat.values[0].cumulative).toBe(650)
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
            value: 50,
            splitAmongEnemies: false,
            special: {
              type: 'modifyThreat',
              multiplier: 0.5,
            },
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
        createDamageEvent({
          sourceID: bossEnemy.id,
          targetID: warriorActor.id,
          abilityGameID: SPELLS.MOCK_ABILITY_2,
          amount: 100,
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
      expect(event1.threat.values[0].cumulative).toBe(100)

      // Event 2 is threat modification, verify next event starts from modified baseline
      // 100 * 0.5 = 50. Plus 100 from event 3 = 150.
      const event3 = result.augmentedEvents[2]
      expect(event3.threat.values[0].cumulative).toBe(150)
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
     ]

     const result = processEvents({
       rawEvents: events,
       actorMap,
       enemies: [enemy1, enemy2],
       config,
     })

     const event = result.augmentedEvents[0]
     expect(event.threat.values.length).toBe(2) // Split to both enemies

     // Both enemies get 50 threat, but cumulative tracks total
     const enemy1Threat = event.threat.values.find((v) => v.id === enemy1.id)!
     const enemy2Threat = event.threat.values.find((v) => v.id === enemy2.id)!

     expect(enemy1Threat.amount).toBe(50)
     expect(enemy1Threat.cumulative).toBe(50)
     expect(enemy2Threat.amount).toBe(50)
     expect(enemy2Threat.cumulative).toBe(50)
   })
 
  describe('environmental threat filtering', () => {
    it('generates zero threat when targeting environment (ID -1)', () => {
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

      expect(result.augmentedEvents.length).toBe(0)
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
        { id: -1, name: 'Environment', instance: 0 }
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
      expect(augmented.threat.values.length).toBe(1)
      expect(augmented.threat.values[0].id).toBe(bossEnemy.id)
      // Should receive full threat (100) not split (50)
      expect(augmented.threat.values[0].amount).toBe(100)
    })
  })
})
