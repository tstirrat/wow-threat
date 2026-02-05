/**
 * Tests for Threat Calculation Service
 */

import { describe, it, expect } from 'vitest'
import type { WCLEvent, DamageEvent, HealEvent, EnergizeEvent } from '@wcl-threat/wcl-types'
import {
  type ThreatConfig,
  type Enemy,
  type Actor,
  type ThreatContext,
  type ActorContext,
  type SpellSchool,
} from '@wcl-threat/threat-config'
import { calculateThreat } from './threat'

// ============================================================================
// Mock Actor Context
// ============================================================================

function createMockActorContext(): ActorContext {
  return {
    getPosition: () => null,
    getDistance: () => null,
    getActorsInRange: () => [],
    getThreat: () => 0,
    getTopActorsByThreat: () => [],
  }
}

// ============================================================================
// Mock Threat Config (self-contained, no external dependencies)
// ============================================================================

const mockThreatConfig: ThreatConfig = {
  version: '1.0.0-test',
  gameVersion: 100000,
  baseThreat: {
    damage: (ctx: ThreatContext) => ({
      formula: 'amount',
      value: ctx.amount,
      splitAmongEnemies: false,
    }),
    heal: (ctx: ThreatContext) => {
      // Effective healing: amount - overheal
      const effectiveHeal = ctx.amount
      const baseThreat = effectiveHeal * 0.5 // 50% of heal
      return {
        formula: 'amount * 0.5',
        value: baseThreat,
        splitAmongEnemies: true,
      }
    },
    energize: (ctx: ThreatContext) => ({
      formula: 'amount * 5',
      value: ctx.amount * 5,
      splitAmongEnemies: true,
    }),
  },
  classes: {
    warrior: {
      baseThreatFactor: 1.0,
      auraModifiers: {
        71: (ctx: ThreatContext) => ({
          source: 'stance',
          name: 'Defensive Stance',
          value: 1.3,
        }),
        12305: (ctx: ThreatContext) => ({
          source: 'talent',
          name: 'Defiance (Rank 5)',
          value: 1.15,
        }),
      },
      abilities: {},
    },
    rogue: {
      baseThreatFactor: 0.71,
      auraModifiers: {},
      abilities: {},
    },
    priest: {
      baseThreatFactor: 1.0,
      auraModifiers: {},
      abilities: {},
    },
    druid: {
      baseThreatFactor: 1.0,
      auraModifiers: {
        5487: (ctx: ThreatContext) => ({
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
        25780: (ctx: ThreatContext) => ({
          source: 'stance',
          name: 'Righteous Fury',
          value: 1.6,
          schools: new Set(['holy'] as SpellSchool[]),
        }),
      },
      abilities: {},
    },
    mage: {
      baseThreatFactor: 1.0,
      auraModifiers: {},
      abilities: {},
    },
  },
  auraModifiers: {
    25846: (ctx: ThreatContext) => ({
      source: 'aura',
      name: 'Blessing of Salvation',
      value: 0.7,
    }),
    25895: (ctx: ThreatContext) => ({
      source: 'aura',
      name: 'Greater Blessing of Salvation',
      value: 0.7,
    }),
    26400: (ctx: ThreatContext) => ({
      source: 'aura',
      name: 'Fetish of the Sand Reaver',
      value: 0.3,
    }),
  },
  untauntableEnemies: new Set(),
}

// ============================================================================
// Test Helpers
// ============================================================================

function createDamageEvent(overrides: Partial<DamageEvent> = {}): DamageEvent {
  return {
    timestamp: 1000,
    type: 'damage',
    sourceID: 1,
    sourceIsFriendly: true,
    targetID: 25,
    targetIsFriendly: false,
    ability: {
      guid: 12345,
      name: 'Test Attack',
      type: 1,
      abilityIcon: 'test.jpg',
    },
    amount: 1000,
    absorbed: 0,
    blocked: 0,
    mitigated: 0,
    overkill: 0,
    hitType: 'hit',
    tick: false,
    multistrike: false,
    ...overrides,
  }
}

function createHealEvent(overrides: Partial<HealEvent> = {}): HealEvent {
  return {
    timestamp: 1000,
    type: 'heal',
    sourceID: 2,
    sourceIsFriendly: true,
    targetID: 1,
    targetIsFriendly: true,
    ability: {
      guid: 25314,
      name: 'Greater Heal',
      type: 2,
      abilityIcon: 'heal.jpg',
    },
    amount: 4000,
    absorbed: 0,
    overheal: 500,
    tick: false,
    ...overrides,
  }
}

const defaultActor: Actor = { id: 1, name: 'TestPlayer', class: 'warrior' }
const defaultEnemy: Enemy = { id: 25, name: 'TestBoss', instance: 0 }

interface TestCallOptions {
  sourceAuras?: Set<number>
  targetAuras?: Set<number>
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
    enemies: overrides.enemies ?? [defaultEnemy],
    sourceActor: overrides.sourceActor ?? defaultActor,
    targetActor: overrides.targetActor ?? { id: 25, name: 'Boss', class: null },
    encounterId: overrides.encounterId ?? null,
    actors: createMockActorContext(),
  }
}

describe('calculateThreat', () => {
  describe('damage events', () => {
    it('calculates basic damage threat', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateThreat(
        event,
        createTestOptions(),
        mockThreatConfig
      )

      expect(result.calculation.baseThreat).toBe(1000)
      expect(result.calculation.threatToEnemy).toBe(1000)
      expect(result.values).toHaveLength(1)
      expect(result.values[0]?.amount).toBe(1000)
      expect(result.values[0]?.isSplit).toBe(false)
    })

    it('applies Defensive Stance modifier', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateThreat(
        event,
        createTestOptions({
          sourceAuras: new Set([71]), // Defensive Stance
        }),
        mockThreatConfig
      )

      expect(result.calculation.modifiers).toContainEqual(
        expect.objectContaining({ name: 'Defensive Stance', value: 1.3 })
      )
      expect(result.calculation.threatToEnemy).toBe(1300) // 1000 * 1.3
    })

    it('applies multiple modifiers multiplicatively', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateThreat(
        event,
        createTestOptions({
          // Defensive Stance (1.3) + Defiance Rank 5 (1.15)
          sourceAuras: new Set([71, 12305]),
        }),
        mockThreatConfig
      )

      expect(result.calculation.modifiers).toHaveLength(2)
      // 1000 * 1.3 * 1.15 = 1495
      expect(result.calculation.threatToEnemy).toBeCloseTo(1495, 0)
    })

    it('applies base threat factor (Rogue)', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateThreat(
        event,
        createTestOptions({
          sourceActor: { id: 1, name: 'RoguePlayer', class: 'rogue' },
        }),
        mockThreatConfig
      )

      // Modifiers should contain the base modifier named "Rogue"
      expect(result.calculation.modifiers).toContainEqual(
        expect.objectContaining({ name: 'Rogue', value: 0.71 })
      )
      // 1000 * 0.71 = 710
      expect(result.calculation.threatToEnemy).toBe(710)
    })

    it('does not apply base threat factor for standard classes (Warrior)', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateThreat(
        event,
        createTestOptions({
          sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
        }),
        mockThreatConfig
      )

      // Should verify that NO modifier with source 'class' or name 'Warrior' exists
      const baseModifiers = result.calculation.modifiers.filter(m => m.source === 'class')
      expect(baseModifiers).toHaveLength(0)

      // Should be 1000 flat
      expect(result.calculation.threatToEnemy).toBe(1000)
    })
  })

  describe('healing events', () => {
    it('calculates healing threat split among enemies', () => {
      const event = createHealEvent({
        amount: 4000,
        overheal: 500,
      })

      const enemies = [
        { id: 25, name: 'Boss', instance: 0 },
        { id: 26, name: 'Add', instance: 0 },
      ]

      const result = calculateThreat(
        event,
        createTestOptions({
          enemies,
          sourceActor: { id: 2, name: 'Healer', class: 'priest' },
          targetActor: defaultActor,
        }),
        mockThreatConfig
      )

      // Effective heal: 3500, base threat: 1750, split 2 ways: 875 each
      expect(result.calculation.baseThreat).toBe(1750)
      expect(result.values).toHaveLength(2)
      expect(result.values[0]?.amount).toBe(875)
      expect(result.values[0]?.isSplit).toBe(true)
      expect(result.values[1]?.amount).toBe(875)
    })
  })

  describe('energize events', () => {
    function createEnergizeEvent(overrides: Partial<EnergizeEvent> = {}): EnergizeEvent {
      return {
        timestamp: 1000,
        type: 'energize',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        ability: {
          guid: 12975,
          name: 'Rage Gain',
          type: 1,
          abilityIcon: 'rage.jpg',
        },
        resourceChange: 20,
        resourceChangeType: 'rage',
        waste: 0,
        ...overrides,
      }
    }

    it('calculates threat from resource generation', () => {
      const event = createEnergizeEvent({ resourceChange: 30 })

      const result = calculateThreat(
        event,
        createTestOptions({
          sourceActor: defaultActor,
          targetActor: defaultActor,
        }),
        mockThreatConfig
      )

      // Energize events generate threat: rage * 5
      expect(result.calculation.baseValue).toBe(30)
      expect(result.calculation.baseThreat).toBe(150) // 30 * 5
      expect(result.values).toHaveLength(1)
    })

    it('splits threat among all enemies', () => {
      const event = createEnergizeEvent({ resourceChange: 40 })

      const enemies = [
        { id: 25, name: 'Boss', instance: 0 },
        { id: 26, name: 'Add', instance: 0 },
      ]

      const result = calculateThreat(
        event,
        createTestOptions({
          enemies,
          sourceActor: defaultActor,
          targetActor: defaultActor,
        }),
        mockThreatConfig
      )

      // 40 rage * 5 = 200 base threat, split 2 ways = 100 each
      expect(result.calculation.baseThreat).toBe(200)
      expect(result.values).toHaveLength(2)
      expect(result.values[0]?.amount).toBe(100)
      expect(result.values[0]?.isSplit).toBe(true)
      expect(result.values[1]?.amount).toBe(100)
      expect(result.values[1]?.isSplit).toBe(true)
    })

    it('subtracts waste from resource change', () => {
      const event = createEnergizeEvent({ resourceChange: 30, waste: 5 })

      const result = calculateThreat(
        event,
        createTestOptions({
          sourceActor: defaultActor,
          targetActor: defaultActor,
        }),
        mockThreatConfig
      )

      // Only 25 rage actually gained (30 - 5 waste), threat = 25 * 5 = 125
      expect(result.calculation.baseValue).toBe(25)
      expect(result.calculation.baseThreat).toBe(125)
    })
  })

  describe('unknown event types', () => {
    it('returns zero threat for unsupported event types', () => {
      // Cast events don't generate threat directly (no amount)
      const event = {
        timestamp: 1000,
        type: 'cast' as const,
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 25,
        targetIsFriendly: false,
        ability: {
          guid: 100,
          name: 'Some Spell',
          type: 1,
          abilityIcon: 'spell.jpg',
        },
      }

      const result = calculateThreat(
        event as WCLEvent,
        createTestOptions(),
        mockThreatConfig
      )

      expect(result.calculation.baseThreat).toBe(0)
      expect(result.calculation.formula).toBe('0')
    })
  })

  describe('edge cases', () => {
    it('handles empty enemy list', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateThreat(
        event,
        createTestOptions({
          enemies: [],
        }),
        mockThreatConfig
      )

      // With no enemies, threat values should be empty or have no enemy to apply to
      expect(result.values).toHaveLength(0)
    })

    it('handles actors without class', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateThreat(
        event,
        createTestOptions({
          sourceActor: { id: 99, name: 'Pet', class: null },
        }),
        mockThreatConfig
      )

      // Should still calculate base threat without class modifiers
      expect(result.calculation.baseThreat).toBe(1000)
    })
  })

  describe('aura modifiers', () => {
    describe('cross-class aura modifiers', () => {
      it('applies Blessing of Salvation to Warriors', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([25846]), // Blessing of Salvation
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig
        )

        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Blessing of Salvation', value: 0.7 })
        )
        // 1000 * 0.7 = 700
        expect(result.calculation.threatToEnemy).toBe(700)
      })

      it('applies Blessing of Salvation to Rogues and stacks with base threat', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([25846]), // Blessing of Salvation
            sourceActor: { id: 1, name: 'RoguePlayer', class: 'rogue' },
          }),
          mockThreatConfig
        )

        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Rogue', value: 0.71 })
        )
        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Blessing of Salvation', value: 0.7 })
        )
        // 1000 * 0.71 * 0.7 = 497
        expect(result.calculation.threatToEnemy).toBeCloseTo(497, 0)
      })

      it('applies Greater Blessing of Salvation to Mages', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([25895]), // Greater Blessing of Salvation
            sourceActor: { id: 1, name: 'MagePlayer', class: 'mage' },
          }),
          mockThreatConfig
        )

        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Greater Blessing of Salvation', value: 0.7 })
        )
        // 1000 * 0.7 = 700
        expect(result.calculation.threatToEnemy).toBe(700)
      })
    })

    describe('global aura modifiers', () => {
      it('applies Fetish of the Sand Reaver to Warriors', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([26400]), // Fetish of the Sand Reaver
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig
        )

        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Fetish of the Sand Reaver', value: 0.3 })
        )
        // 1000 * 0.3 = 300
        expect(result.calculation.threatToEnemy).toBe(300)
      })

      it('applies Fetish of the Sand Reaver to Mages', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([26400]), // Fetish of the Sand Reaver
            sourceActor: { id: 1, name: 'MagePlayer', class: 'mage' },
          }),
          mockThreatConfig
        )

        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Fetish of the Sand Reaver', value: 0.3 })
        )
        // 1000 * 0.3 = 300
        expect(result.calculation.threatToEnemy).toBe(300)
      })
    })

    describe('aura modifier stacking and merge behavior', () => {
      it('stacks cross-class buff with class-specific stance', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateThreat(
          event,
          createTestOptions({
            // Defensive Stance (1.3x) + Blessing of Salvation (0.7x)
            sourceAuras: new Set([71, 25846]),
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig
        )

        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Defensive Stance', value: 1.3 })
        )
        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Blessing of Salvation', value: 0.7 })
        )
        // 1000 * 1.3 * 0.7 = 910
        expect(result.calculation.threatToEnemy).toBeCloseTo(910, 0)
      })

      it('stacks multiple cross-class buffs', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateThreat(
          event,
          createTestOptions({
            // Blessing of Salvation (0.7x) + Fetish of the Sand Reaver (0.3x)
            sourceAuras: new Set([25846, 26400]),
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig
        )

        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Blessing of Salvation', value: 0.7 })
        )
        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Fetish of the Sand Reaver', value: 0.3 })
        )
        // 1000 * 0.7 * 0.3 = 210
        expect(result.calculation.threatToEnemy).toBe(210)
      })

      it('stacks three modifiers (class stance + talent + cross-class buff)', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateThreat(
          event,
          createTestOptions({
            // Defensive Stance (1.3x) + Defiance Rank 5 (1.15x) + Blessing of Salvation (0.7x)
            sourceAuras: new Set([71, 12305, 25846]),
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig
        )

        expect(result.calculation.modifiers).toHaveLength(3)
        // 1000 * 1.3 * 1.15 * 0.7 = 1046.5
        expect(result.calculation.threatToEnemy).toBeCloseTo(1046.5, 0)
      })
    })

    describe('class-specific aura modifiers still work', () => {
      it('applies Defensive Stance to Warriors', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([71]), // Defensive Stance
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig
        )

        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Defensive Stance', value: 1.3 })
        )
        expect(result.calculation.threatToEnemy).toBe(1300)
      })

      it('applies Bear Form to Druids', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([5487]), // Bear Form
            sourceActor: { id: 1, name: 'DruidPlayer', class: 'druid' },
          }),
          mockThreatConfig
        )

        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Bear Form', value: 1.3 })
        )
        expect(result.calculation.threatToEnemy).toBe(1300)
      })

      it('applies Righteous Fury to Paladin holy spells only', () => {
        // Test a damage event with a holy spell
        const holyDamageEvent = createDamageEvent({
          amount: 1000,
          ability: {
            guid: 25742, // Seal of Righteousness (holy school)
            name: 'Seal of Righteousness',
            type: 2,
            abilityIcon: 'ability_thunderbolt.jpg',
          },
        })

        const result = calculateThreat(
          holyDamageEvent,
          createTestOptions({
            sourceAuras: new Set([25780]), // Righteous Fury
            sourceActor: { id: 1, name: 'PaladinPlayer', class: 'paladin' },
          }),
          mockThreatConfig
        )

        // Righteous Fury should apply to holy spells
        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Righteous Fury', value: 1.6 })
        )
      })

      it('applies Defiance talent to Warriors', () => {
        const event = createDamageEvent({ amount: 1000 })

        const result = calculateThreat(
          event,
          createTestOptions({
            sourceAuras: new Set([12305]), // Defiance Rank 5
            sourceActor: { id: 1, name: 'WarriorPlayer', class: 'warrior' },
          }),
          mockThreatConfig
        )

        expect(result.calculation.modifiers).toContainEqual(
          expect.objectContaining({ name: 'Defiance (Rank 5)', value: 1.15 })
        )
        expect(result.calculation.threatToEnemy).toBe(1150)
      })
    })
  })
})
