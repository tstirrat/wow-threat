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
  CombatantInfoAura,
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

// Test fixtures
const warriorActor: Actor = { id: 1, name: 'WarriorTank', class: 'warrior' }
const priestActor: Actor = { id: 2, name: 'PriestHealer', class: 'priest' }
const unknownActor: Actor = { id: 99, name: 'Unknown', class: null }

const bossEnemy: Enemy = { id: 25, name: 'Boss', instance: 0 }
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
 * Create a minimal mock threat config for testing
 */
function createMockConfig(): ThreatConfig {
  return {
    version: 'test-1.0.0',
    gameVersion: 1,

    baseThreat: {
      damage: (ctx: ThreatContext) => ({
        formula: '2 * damage',
        baseThreat: ctx.amount * 2,
        modifiers: [],
        splitAmongEnemies: false,
      }),
      heal: (ctx: ThreatContext) => ({
        formula: '0.5 * heal',
        baseThreat: ctx.amount * 0.5,
        modifiers: [],
        splitAmongEnemies: false,
      }),
      energize: (ctx: ThreatContext) => ({
        formula: '0.5 * resourceChange',
        baseThreat: ctx.amount * 0.5,
        modifiers: [],
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
            baseThreat: ctx.amount + 100,
            modifiers: [],
            splitAmongEnemies: false,
          }),

          // Mock ability that splits threat
          [SPELLS.MOCK_ABILITY_2]: (ctx: ThreatContext) => ({
            formula: '0.5 * amt',
            baseThreat: ctx.amount * 0.5,
            modifiers: [],
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
    },

    untauntableEnemies: new Set(),
    globalModifiers: {},
    fixateBuffs: new Set(),
    aggroLossBuffs: new Set(),
    invulnerabilityBuffs: new Set(),
  }
}

const mockConfig = createMockConfig()

function createCombatantInfoAura(
  abilityId: number,
  name: string,
  sourceId: number = warriorActor.id
): CombatantInfoAura {
  return {
    source: sourceId,
    ability: abilityId,
    stacks: 1,
    icon: `spell_${name.toLowerCase().replace(/\s/g, '_')}.png`,
    name,
  }
}

describe('processEvents', () => {
  describe('event counting', () => {
    it('counts event types correctly', () => {
      const actorMap = new Map<number, Actor>([[warriorActor.id, warriorActor]])

      const events: WCLEvent[] = [
        createDamageEvent({ sourceID: warriorActor.id, targetID: bossEnemy.id }),
        createDamageEvent({ sourceID: warriorActor.id, targetID: bossEnemy.id }),
        createHealEvent({ sourceID: warriorActor.id, targetID: warriorActor.id }),
        createApplyBuffEvent({ targetID: warriorActor.id, abilityId: SPELLS.DEFENSIVE_STANCE }),
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
          abilityId: SPELLS.MOCK_AURA_THREAT_UP,
          abilityName: 'Test Threat Up',
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
          abilityId: SPELLS.MOCK_AURA_THREAT_UP,
          abilityName: 'Test Threat Up',
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
          abilityId: SPELLS.MOCK_ABILITY_1,
          abilityName: 'Mock Ability 1',
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
          abilityId: SPELLS.MOCK_ABILITY_2, // This ability splits threat
          abilityName: 'Mock Ability 2',
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
      expect(augmented.threat.values[0].isSplit).toBe(true)
      expect(augmented.threat.values[1].isSplit).toBe(true)
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
      // Base formula: 0.5 * 1000 = 500
      expect(augmented.threat.calculation.baseThreat).toBe(500)
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
      expect(augmented.threat.values[0].enemyId).toBe(bossEnemy.id)
      expect(augmented.threat.values[0].isSplit).toBe(false)
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

      const augmented = result.augmentedEvents[0]
      expect(augmented.threat).toBeDefined()
      // Damage to friendly targets generates no threat to enemies
      expect(augmented.threat.values.length).toBe(0)
      expect(augmented.threat.calculation.threatToEnemy).toBe(0)
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
        ability: {
          guid: SPELLS.MOCK_ABILITY_1,
          name: 'Mock Ability',
          type: 1,
          abilityIcon: 'ability_mock.png',
        },
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
      expect(augmented.ability?.guid).toBe(SPELLS.MOCK_ABILITY_1)
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
      expect(augmented.threat.calculation.baseValue).toBe(1000)
      expect(augmented.threat.calculation.baseThreat).toBeGreaterThan(0)
      expect(augmented.threat.calculation.threatToEnemy).toBeGreaterThan(0)
      expect(augmented.threat.calculation.modifiers).toBeDefined()
      expect(Array.isArray(augmented.threat.calculation.modifiers)).toBe(true)
    })
  })
})

// Helper functions to create test events

interface DamageEventOptions {
  sourceID?: number
  targetID?: number
  sourceIsFriendly?: boolean
  targetIsFriendly?: boolean
  abilityId?: number
  abilityName?: string
  amount?: number
}

function createDamageEvent(options: DamageEventOptions = {}): DamageEvent {
  return {
    timestamp: 1000,
    type: 'damage',
    sourceID: options.sourceID ?? 1,
    sourceIsFriendly: options.sourceIsFriendly ?? true,
    targetID: options.targetID ?? 25,
    targetIsFriendly: options.targetIsFriendly ?? false,
    ability: {
      guid: options.abilityId ?? 1,
      name: options.abilityName ?? 'Auto Attack',
      type: 1,
      abilityIcon: 'ability_meleedamage.png',
    },
    amount: options.amount ?? 100,
    absorbed: 0,
    blocked: 0,
    mitigated: 0,
    overkill: 0,
    hitType: 'hit',
    tick: false,
    multistrike: false,
  }
}

interface HealEventOptions {
  sourceID?: number
  targetID?: number
  abilityId?: number
  abilityName?: string
  amount?: number
  overheal?: number
}

function createHealEvent(options: HealEventOptions = {}): HealEvent {
  return {
    timestamp: 1000,
    type: 'heal',
    sourceID: options.sourceID ?? 2,
    sourceIsFriendly: true,
    targetID: options.targetID ?? 1,
    targetIsFriendly: true,
    ability: {
      guid: options.abilityId ?? 1,
      name: options.abilityName ?? 'Heal',
      type: 2,
      abilityIcon: 'spell_holy_heal.png',
    },
    amount: options.amount ?? 1000,
    absorbed: 0,
    overheal: options.overheal ?? 0,
    tick: false,
  }
}

interface ApplyBuffEventOptions {
  targetID?: number
  abilityId?: number
  abilityName?: string
}

function createApplyBuffEvent(
  options: ApplyBuffEventOptions = {}
): ApplyBuffEvent {
  return {
    timestamp: 1000,
    type: 'applybuff',
    sourceID: options.targetID ?? 1,
    sourceIsFriendly: true,
    targetID: options.targetID ?? 1,
    targetIsFriendly: true,
    ability: {
      guid: options.abilityId ?? 1,
      name: options.abilityName ?? 'Buff',
      type: 1,
      abilityIcon: 'spell_holy_buff.png',
    },
  }
}

interface RemoveBuffEventOptions {
  targetID?: number
  abilityId?: number
  abilityName?: string
}

function createRemoveBuffEvent(
  options: RemoveBuffEventOptions = {}
): RemoveBuffEvent {
  return {
    timestamp: 2000,
    type: 'removebuff',
    sourceID: options.targetID ?? 1,
    sourceIsFriendly: true,
    targetID: options.targetID ?? 1,
    targetIsFriendly: true,
    ability: {
      guid: options.abilityId ?? 1,
      name: options.abilityName ?? 'Buff',
      type: 1,
      abilityIcon: 'spell_holy_buff.png',
    },
  }
}
