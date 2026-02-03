/**
 * Tests for FightState
 *
 * Verifies event dispatching to per-actor trackers, combatant info processing,
 * and gear implications coordination.
 */

import { describe, it, expect } from 'vitest'
import type { WCLEvent, GearItem } from '@wcl-threat/wcl-types'
import type { ThreatConfig, Actor, ThreatContext } from '@wcl-threat/threat-config'

import { FightState } from './fight-state'

// ============================================================================
// Test Helpers & Mock Config
// ============================================================================

// Spell IDs for testing
const TEST_SPELLS = {
  DEFENSIVE_STANCE: 71,
  BATTLE_STANCE: 2457,
  BERSERKER_STANCE: 2458,
  BLESSING_OF_KINGS: 25898,
  BLESSING_OF_SALVATION: 25846,
  BLESSING_OF_MIGHT: 27140,
  BLESSING_OF_WISDOM: 27142,
  BEAR_FORM: 5487,
  CAT_FORM: 768,
  DIRE_BEAR_FORM: 9634,
  SYNTHETIC_AURA: 99999,
} as const

/** Minimal test config with exclusive auras for testing */
function createTestConfig(): ThreatConfig {
  return {
    version: 'test-1.0.0',
    gameVersion: 1,
    baseThreat: {
      damage: (ctx: ThreatContext) => ({
        formula: 'amt',
        baseThreat: ctx.amount,
        modifiers: [],
        splitAmongEnemies: false,
      }),
      heal: (ctx: ThreatContext) => ({
        formula: 'amt * 0.5',
        baseThreat: ctx.amount * 0.5,
        modifiers: [],
        splitAmongEnemies: false,
      }),
      energize: (ctx: ThreatContext) => ({
        formula: 'amt * 0.5',
        baseThreat: ctx.amount * 0.5,
        modifiers: [],
        splitAmongEnemies: false,
      }),
    },
    classes: {
      warrior: {
        exclusiveAuras: [
          new Set([TEST_SPELLS.DEFENSIVE_STANCE, TEST_SPELLS.BATTLE_STANCE, TEST_SPELLS.BERSERKER_STANCE]),
        ],
        auraModifiers: {},
        abilities: {},
      },
      paladin: {
        exclusiveAuras: [
          new Set([
            TEST_SPELLS.BLESSING_OF_KINGS,
            TEST_SPELLS.BLESSING_OF_SALVATION,
            TEST_SPELLS.BLESSING_OF_MIGHT,
            TEST_SPELLS.BLESSING_OF_WISDOM,
          ]),
        ],
        auraModifiers: {},
        abilities: {},
      },
      rogue: {
        auraModifiers: {},
        abilities: {},
      },
      druid: {
        exclusiveAuras: [
          new Set([TEST_SPELLS.BEAR_FORM, TEST_SPELLS.CAT_FORM, TEST_SPELLS.DIRE_BEAR_FORM]),
        ],
        auraModifiers: {},
        abilities: {},
      },
    },
    untauntableEnemies: new Set(),
    fixateBuffs: new Set(),
    aggroLossBuffs: new Set(),
    invulnerabilityBuffs: new Set(),
  }
}

function createActorMap(
  actors: Array<{ id: number; name: string; class: string | null }>,
): Map<number, Actor> {
  const map = new Map<number, Actor>()
  for (const a of actors) {
    map.set(a.id, { id: a.id, name: a.name, class: a.class as Actor['class'] })
  }
  return map
}

const defaultActorMap = createActorMap([
  { id: 1, name: 'Warrior', class: 'warrior' },
  { id: 2, name: 'Rogue', class: 'rogue' },
])

const testConfig = createTestConfig()

/** Build a config with a custom gearImplications for warrior */
function createConfigWithGearImplications(
  gearImplications: (gear: GearItem[]) => number[],
): ThreatConfig {
  return {
    ...testConfig,
    classes: {
      ...testConfig.classes,
      warrior: {
        ...testConfig.classes.warrior!,
        gearImplications,
      },
    },
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('FightState', () => {
  describe('aura event routing', () => {
    it('routes applybuff to target actor aura tracker', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 0,
          type: 'applybuff',
          sourceID: 2,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          ability: { guid: 71, name: 'Defensive Stance', type: 1, abilityIcon: '' },
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(true)
      expect(state.getAuras(2).size).toBe(0)
    })

    it('routes removebuff to target actor aura tracker', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 0,
          type: 'applybuff',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          ability: { guid: 71, name: 'Defensive Stance', type: 1, abilityIcon: '' },
        } as WCLEvent,
        testConfig,
      )

      state.processEvent(
        {
          timestamp: 100,
          type: 'removebuff',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          ability: { guid: 71, name: 'Defensive Stance', type: 1, abilityIcon: '' },
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(false)
    })

    it('routes applydebuff to target actor', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 0,
          type: 'applydebuff',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 25,
          targetIsFriendly: false,
          ability: { guid: 12345, name: 'Sunder Armor', type: 1, abilityIcon: '' },
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(25).has(12345)).toBe(true)
    })

    it('routes removedebuff to target actor', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 0,
          type: 'applydebuff',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 25,
          targetIsFriendly: false,
          ability: { guid: 12345, name: 'Sunder Armor', type: 1, abilityIcon: '' },
        } as WCLEvent,
        testConfig,
      )

      state.processEvent(
        {
          timestamp: 100,
          type: 'removedebuff',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 25,
          targetIsFriendly: false,
          ability: { guid: 12345, name: 'Sunder Armor', type: 1, abilityIcon: '' },
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(25).has(12345)).toBe(false)
    })

    it('ignores non-aura, non-combatantinfo events', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 0,
          type: 'damage',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 25,
          targetIsFriendly: false,
          ability: { guid: 100, name: 'Attack', type: 1, abilityIcon: '' },
          amount: 500,
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(1).size).toBe(0)
      expect(state.getAuras(25).size).toBe(0)
    })

    it('returns empty set for unknown actors', () => {
      const state = new FightState(defaultActorMap, testConfig)

      expect(state.getAuras(999).size).toBe(0)
    })
  })

  describe('combatantinfo processing', () => {
    it('seeds initial auras from combatant info', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 0,
          type: 'combatantinfo',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          auras: [
            { source: 1, ability: 71, stacks: 1, icon: '', name: 'Defensive Stance' },
            { source: 2, ability: 25780, stacks: 1, icon: '', name: 'Blessing of Might' },
          ],
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(true)
      expect(state.getAuras(1).has(25780)).toBe(true)
    })

    it('stores gear from combatant info', () => {
      const state = new FightState(defaultActorMap, testConfig)
      const gear = [
        { id: 19019, setID: 498 },
        { id: 18814, temporaryEnchant: 2505 },
      ]

      state.processEvent(
        {
          timestamp: 0,
          type: 'combatantinfo',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          gear,
        } as WCLEvent,
        testConfig,
      )

      expect(state.getGear(1)).toEqual(gear)
    })

    it('handles combatant info with no auras or gear', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 0,
          type: 'combatantinfo',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(1).size).toBe(0)
      expect(state.getGear(1)).toEqual([])
    })

    it('runs gearImplications and injects synthetic auras', () => {
      const SYNTHETIC_AURA_ID = 99999
      const config = createConfigWithGearImplications((gear) => {
        // If any gear has setID 498, inject a synthetic aura
        const hasSet = gear.some((g) => g.setID === 498)
        return hasSet ? [SYNTHETIC_AURA_ID] : []
      })

      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 0,
          type: 'combatantinfo',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          gear: [
            { id: 19019, setID: 498 },
            { id: 18814 },
          ],
        } as WCLEvent,
        config,
      )

      expect(state.getAuras(1).has(SYNTHETIC_AURA_ID)).toBe(true)
    })

    it('does not run gearImplications when class config has none', () => {
      const state = new FightState(defaultActorMap, testConfig)

      // Rogue has no gearImplications defined
      state.processEvent(
        {
          timestamp: 0,
          type: 'combatantinfo',
          sourceID: 2,
          sourceIsFriendly: true,
          targetID: 2,
          targetIsFriendly: true,
          gear: [{ id: 19019, setID: 498 }],
        } as WCLEvent,
        testConfig,
      )

      // Should still store gear even without gearImplications
      expect(state.getGear(2)).toHaveLength(1)
    })

    it('does not run gearImplications for actors without a class', () => {
      const actorMap = createActorMap([
        { id: 50, name: 'Unknown Pet', class: null },
      ])
      const SYNTHETIC_AURA_ID = 99999
      const config = createConfigWithGearImplications(() => [SYNTHETIC_AURA_ID])

      const state = new FightState(actorMap, config)

      state.processEvent(
        {
          timestamp: 0,
          type: 'combatantinfo',
          sourceID: 50,
          sourceIsFriendly: true,
          targetID: 50,
          targetIsFriendly: true,
          gear: [{ id: 19019 }],
        } as WCLEvent,
        config,
      )

      // Gear stored but no synthetic auras since class is null
      expect(state.getGear(50)).toHaveLength(1)
      expect(state.getAuras(50).has(SYNTHETIC_AURA_ID)).toBe(false)
    })
  })

  describe('getActorState', () => {
    it('returns undefined for actors that have no events', () => {
      const state = new FightState(defaultActorMap, testConfig)

      expect(state.getActorState(999)).toBeUndefined()
    })

    it('returns actor state after an event is processed', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 0,
          type: 'applybuff',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          ability: { guid: 71, name: 'Defensive Stance', type: 1, abilityIcon: '' },
        } as WCLEvent,
        testConfig,
      )

      const actorState = state.getActorState(1)
      expect(actorState).toBeDefined()
      expect(actorState!.auras.has(71)).toBe(true)
    })
  })

  describe('cross-class exclusive auras', () => {
    it('applies paladin blessing exclusivity to warriors', () => {
      // Warrior (actor ID 1) receives paladin blessings
      const state = new FightState(defaultActorMap, testConfig)

      // Apply Blessing of Might to warrior
      state.processEvent(
        {
          timestamp: 0,
          type: 'applybuff',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          ability: { guid: TEST_SPELLS.BLESSING_OF_MIGHT, name: 'Blessing of Might', type: 1, abilityIcon: '' },
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(1).has(TEST_SPELLS.BLESSING_OF_MIGHT)).toBe(true)

      // Apply Blessing of Salvation - should remove Blessing of Might
      state.processEvent(
        {
          timestamp: 100,
          type: 'applybuff',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          ability: { guid: TEST_SPELLS.BLESSING_OF_SALVATION, name: 'Blessing of Salvation', type: 1, abilityIcon: '' },
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(1).has(TEST_SPELLS.BLESSING_OF_MIGHT)).toBe(false)
      expect(state.getAuras(1).has(TEST_SPELLS.BLESSING_OF_SALVATION)).toBe(true)
    })

    it('applies druid form exclusivity to druids', () => {
      // Druid receives druid forms (testing that multiple class configs are consolidated)
      const actorMap = createActorMap([
        { id: 1, name: 'Warrior', class: 'warrior' },
        { id: 2, name: 'Rogue', class: 'rogue' },
        { id: 3, name: 'Druid', class: 'druid' },
      ])
      const state = new FightState(actorMap, testConfig)

      // Apply Bear Form to druid
      state.processEvent(
        {
          timestamp: 0,
          type: 'applybuff',
          sourceID: 3,
          sourceIsFriendly: true,
          targetID: 3,
          targetIsFriendly: true,
          ability: { guid: TEST_SPELLS.BEAR_FORM, name: 'Bear Form', type: 1, abilityIcon: '' },
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(3).has(TEST_SPELLS.BEAR_FORM)).toBe(true)

      // Apply Cat Form - should remove Bear Form
      state.processEvent(
        {
          timestamp: 100,
          type: 'applybuff',
          sourceID: 3,
          sourceIsFriendly: true,
          targetID: 3,
          targetIsFriendly: true,
          ability: { guid: TEST_SPELLS.CAT_FORM, name: 'Cat Form', type: 1, abilityIcon: '' },
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(3).has(TEST_SPELLS.BEAR_FORM)).toBe(false)
      expect(state.getAuras(3).has(TEST_SPELLS.CAT_FORM)).toBe(true)
    })
  })
})
