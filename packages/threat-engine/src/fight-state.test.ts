/**
 * Tests for FightState
 *
 * Verifies event dispatching to per-actor trackers, combatant info processing,
 * and talent/gear implication coordination.
 */
import {
  createApplyBuffEvent,
  createCombatantInfoEvent,
  createMockThreatConfig,
  createRemoveBuffEvent,
} from '@wcl-threat/shared'
import {
  createApplyBuffStackEvent,
  createApplyDebuffEvent,
  createApplyDebuffStackEvent,
  createCombatantInfoAura,
  createDamageEvent,
  createRefreshBuffEvent,
  createRefreshDebuffEvent,
  createRemoveBuffStackEvent,
  createRemoveDebuffEvent,
  createRemoveDebuffStackEvent,
} from '@wcl-threat/shared'
import type {
  Actor,
  TalentImplicationsFn,
  ThreatConfig,
  ThreatContext,
} from '@wcl-threat/shared'
import type { GearItem, WCLEvent } from '@wcl-threat/wcl-types'
import { describe, expect, it } from 'vitest'

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
  RAKE: 9904,
  SYNTHETIC_AURA: 99999,
  GLOBAL_COMBATANT_AURA: 99998,
} as const

/** Minimal test config with exclusive auras for testing */
const testConfig = createMockThreatConfig({
  baseThreat: {
    damage: (ctx: ThreatContext) => ({
      formula: 'amt',
      value: ctx.amount,
      splitAmongEnemies: false,
    }),
    absorbed: (ctx: ThreatContext) => ({
      formula: 'amt',
      value: ctx.amount,
      splitAmongEnemies: false,
    }),
    heal: (ctx: ThreatContext) => ({
      formula: 'amt * 0.5',
      value: ctx.amount * 0.5,
      splitAmongEnemies: false,
    }),
    energize: (ctx: ThreatContext) => ({
      formula: 'amt * 0.5',
      value: ctx.amount * 0.5,
      splitAmongEnemies: false,
    }),
  },
  classes: {
    warrior: {
      baseThreatFactor: 1.0,
      exclusiveAuras: [
        new Set([
          TEST_SPELLS.DEFENSIVE_STANCE,
          TEST_SPELLS.BATTLE_STANCE,
          TEST_SPELLS.BERSERKER_STANCE,
        ]),
      ],
      auraModifiers: {},
      abilities: {},
    },
    paladin: {
      baseThreatFactor: 1.0,
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
    // rogue from default is included
    druid: {
      baseThreatFactor: 1.0,
      exclusiveAuras: [
        new Set([
          TEST_SPELLS.BEAR_FORM,
          TEST_SPELLS.CAT_FORM,
          TEST_SPELLS.DIRE_BEAR_FORM,
        ]),
      ],
      auraImplications: new Map([
        [TEST_SPELLS.CAT_FORM, new Set([TEST_SPELLS.RAKE])],
      ]),
      auraModifiers: {},
      abilities: {},
    },
  },
})

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

/** Build a config with a custom gearImplications for warrior */
function createConfigWithGearImplications(
  gearImplications: (gear: GearItem[]) => number[],
): ThreatConfig {
  return createMockThreatConfig({
    classes: {
      warrior: {
        baseThreatFactor: 1.0,
        auraModifiers: {},
        abilities: {},
        gearImplications,
      },
      // rogue from default is preserved
    },
  })
}

function createConfigWithImplications({
  globalGearImplications,
  classTalentImplications,
  classGearImplications,
}: {
  globalGearImplications?: (gear: GearItem[]) => number[]
  classTalentImplications?: TalentImplicationsFn
  classGearImplications?: (gear: GearItem[]) => number[]
}): ThreatConfig {
  return createMockThreatConfig({
    classes: {
      warrior: {
        baseThreatFactor: 1.0,
        auraModifiers: {},
        abilities: {},
        talentImplications: classTalentImplications,
        gearImplications: classGearImplications,
      },
    },
    gearImplications: globalGearImplications,
  })
}

// ============================================================================
// Tests
// ============================================================================

describe('FightState', () => {
  describe('aura event routing', () => {
    it('routes applybuff to target actor aura tracker', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createApplyBuffEvent({
          timestamp: 0,
          sourceID: 2,
          targetID: 1,
          abilityGameID: 71,
        }),
        testConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(true)
      expect(state.getAuras(2).size).toBe(0)
    })

    it('routes removebuff to target actor aura tracker', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createApplyBuffEvent({
          timestamp: 0,
          sourceID: 1,
          targetID: 1,
          abilityGameID: 71,
        }),
        testConfig,
      )

      state.processEvent(
        createRemoveBuffEvent({
          timestamp: 100,
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          abilityGameID: 71,
        }),

        testConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(false)
    })

    it('routes applydebuff to target actor', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createApplyDebuffEvent({
          timestamp: 0,
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 25,
          targetIsFriendly: false,
          abilityGameID: 12345,
        }),
        testConfig,
      )

      expect(state.getAuras(25).has(12345)).toBe(true)
    })

    it('routes refreshbuff to target actor aura tracker', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createRefreshBuffEvent({
          timestamp: 0,
          sourceID: 2,
          targetID: 1,
          abilityGameID: 71,
        }),
        testConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(true)
      expect(state.getAuras(2).size).toBe(0)
    })

    it('routes applybuffstack to target actor aura tracker', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createApplyBuffStackEvent({
          timestamp: 0,
          sourceID: 2,
          targetID: 1,
          abilityGameID: 71,
          stacks: 2,
        }),
        testConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(true)
    })

    it('routes refreshdebuff to target actor', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createRefreshDebuffEvent({
          timestamp: 0,
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 25,
          targetIsFriendly: false,
          abilityGameID: 12345,
        }),
        testConfig,
      )

      expect(state.getAuras(25).has(12345)).toBe(true)
    })

    it('routes applydebuffstack to target actor', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createApplyDebuffStackEvent({
          timestamp: 0,
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 25,
          targetIsFriendly: false,
          abilityGameID: 12345,
          stacks: 2,
        }),
        testConfig,
      )

      expect(state.getAuras(25).has(12345)).toBe(true)
    })

    it('routes removedebuff to target actor', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createApplyDebuffEvent({
          timestamp: 0,
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 25,
          targetIsFriendly: false,
          abilityGameID: 12345,
        }),
        testConfig,
      )

      state.processEvent(
        createRemoveDebuffEvent({
          timestamp: 100,
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 25,
          targetIsFriendly: false,
          abilityGameID: 12345,
        }),
        testConfig,
      )

      expect(state.getAuras(25).has(12345)).toBe(false)
    })

    it('removes aura when removebuffstack reaches zero stacks', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createApplyBuffEvent({
          timestamp: 0,
          targetID: 1,
          abilityGameID: 71,
        }),
        testConfig,
      )

      state.processEvent(
        createRemoveBuffStackEvent({
          timestamp: 100,
          targetID: 1,
          abilityGameID: 71,
          stacks: 0,
        }),
        testConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(false)
    })

    it('keeps aura when removebuffstack still has remaining stacks', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createApplyBuffEvent({
          timestamp: 0,
          targetID: 1,
          abilityGameID: 71,
        }),
        testConfig,
      )

      state.processEvent(
        createRemoveBuffStackEvent({
          timestamp: 100,
          targetID: 1,
          abilityGameID: 71,
          stacks: 2,
        }),
        testConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(true)
    })

    it('removes aura when removedebuffstack reaches zero stacks', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createApplyDebuffEvent({
          timestamp: 0,
          targetID: 25,
          targetIsFriendly: false,
          abilityGameID: 12345,
        }),
        testConfig,
      )

      state.processEvent(
        createRemoveDebuffStackEvent({
          timestamp: 100,
          targetID: 25,
          targetIsFriendly: false,
          abilityGameID: 12345,
          stacks: 0,
        }),
        testConfig,
      )

      expect(state.getAuras(25).has(12345)).toBe(false)
    })

    it('ignores non-aura, non-combatantinfo events', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createDamageEvent({
          timestamp: 0,
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 25,
          targetIsFriendly: false,
          abilityGameID: 100,
          amount: 500,
        }),
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
            createCombatantInfoAura(71, 'Defensive Stance', 1),
            createCombatantInfoAura(25780, 'Blessing of Might', 2),
          ],
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(true)
      expect(state.getAuras(1).has(25780)).toBe(true)
    })

    it('seeds initial auras from legacy combatant aura payloads', () => {
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
            {
              source: 1,
              ability: 71,
              stacks: 1,
              icon: 'spell_shadow_deathscream.jpg',
              name: null,
            },
          ],
        } as WCLEvent,
        testConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(true)
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
          gear: [{ id: 19019, setID: 498 }, { id: 18814 }],
        } as WCLEvent,
        config,
      )

      expect(state.getAuras(1).has(SYNTHETIC_AURA_ID)).toBe(true)
    })

    it('runs global gear + class talent + class gear implication hooks together', () => {
      const config = createConfigWithImplications({
        globalGearImplications: (gear) =>
          gear.some((item) => item.setID === 498)
            ? [TEST_SPELLS.GLOBAL_COMBATANT_AURA]
            : [],
        classTalentImplications: ({ talentPoints }) =>
          (talentPoints[2] ?? 0) >= 31 ? [TEST_SPELLS.SYNTHETIC_AURA] : [],
        classGearImplications: (gear) =>
          gear.some((item) => item.setID === 498) ? [123456] : [],
      })
      const state = new FightState(defaultActorMap, config)

      state.processEvent(
        {
          timestamp: 0,
          type: 'combatantinfo',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          gear: [{ id: 19019, setID: 498 }],
          talents: [
            { id: 14, icon: '' },
            { id: 5, icon: '' },
            { id: 31, icon: '' },
          ],
        } as WCLEvent,
        config,
      )

      const auras = state.getAuras(1)
      expect(auras.has(TEST_SPELLS.GLOBAL_COMBATANT_AURA)).toBe(true)
      expect(auras.has(TEST_SPELLS.SYNTHETIC_AURA)).toBe(true)
      expect(auras.has(123456)).toBe(true)
    })

    it('runs class talentImplications without gear using tree-point payloads', () => {
      const TALENT_INFERRED_AURA = 88888
      const config = createConfigWithImplications({
        classTalentImplications: ({ talentPoints }) =>
          (talentPoints[2] ?? 0) >= 31 ? [TALENT_INFERRED_AURA] : [],
      })
      const state = new FightState(defaultActorMap, config)

      state.processEvent(
        {
          timestamp: 0,
          type: 'combatantinfo',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          talents: [
            { id: 14, icon: '' },
            { id: 5, icon: '' },
            { id: 31, icon: '' },
          ],
        } as WCLEvent,
        config,
      )

      expect(state.getAuras(1).has(TALENT_INFERRED_AURA)).toBe(true)
    })

    it('runs class talentImplications using legacy three-tree talent payloads', () => {
      const TALENT_INFERRED_AURA = 77777
      const config = createConfigWithImplications({
        classTalentImplications: ({ talentPoints }) =>
          (talentPoints[2] ?? 0) >= 31 ? [TALENT_INFERRED_AURA] : [],
      })
      const state = new FightState(defaultActorMap, config)

      state.processEvent(
        createCombatantInfoEvent({
          timestamp: 0,
          talents: [
            { id: 14, icon: '' },
            { id: 5, icon: '' },
            { id: 31, icon: '' },
          ],
        }),
        config,
      )

      expect(state.getAuras(1).has(TALENT_INFERRED_AURA)).toBe(true)
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
        createApplyBuffEvent({
          timestamp: 0,
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          abilityGameID: 71,
        }),
        testConfig,
      )

      const actorState = state.getActorState(1)
      expect(actorState).toBeDefined()
      expect(actorState!.auras.has(71)).toBe(true)
    })
  })

  describe('getActor', () => {
    it('returns instance-specific actor snapshots', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 100,
          type: 'cast',
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 2,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 1,
          abilityGameID: 111,
          x: 45,
          y: 91,
        } as WCLEvent,
        testConfig,
      )

      const actor = state.getActor({ id: 1, instanceId: 2 })
      expect(actor).toMatchObject({
        id: 1,
        instanceId: 2,
        name: 'Warrior',
        class: 'warrior',
        alive: true,
        position: { x: 45, y: 91 },
        currentTarget: { targetId: 99, targetInstance: 1 },
      })
    })

    it('returns defensive snapshots that cannot mutate internal state', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.setAura(1, TEST_SPELLS.DEFENSIVE_STANCE)
      const actor = state.getActor({ id: 1, instanceId: 0 })
      expect(actor).not.toBeNull()

      const mutableActor = actor as unknown as {
        position: { x: number; y: number } | null
        auras: Set<number>
      }
      mutableActor.position = { x: 999, y: 999 }
      mutableActor.auras.add(123456)

      const runtimeActor = state.getActor({ id: 1, instanceId: 0 })
      expect(runtimeActor?.position).toBeNull()
      expect(state.getAuras(1).has(123456)).toBe(false)
    })

    it('does not overwrite source position from damage coordinates', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 100,
          type: 'cast',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 99,
          targetIsFriendly: false,
          abilityGameID: 111,
          x: 45,
          y: 91,
        } as WCLEvent,
        testConfig,
      )

      state.processEvent(
        createDamageEvent({
          timestamp: 200,
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 99,
          targetIsFriendly: false,
          x: 999,
          y: 999,
        }),
        testConfig,
      )

      expect(state.getActor({ id: 1, instanceId: 0 })?.position).toEqual({
        x: 45,
        y: 91,
      })
    })

    it('updates target position from target-side damage coordinates', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 100,
          type: 'damage',
          sourceID: 25,
          sourceIsFriendly: false,
          targetID: 1,
          targetIsFriendly: false,
          abilityGameID: 1,
          amount: 100,
          absorbed: 0,
          blocked: 0,
          mitigated: 0,
          overkill: 0,
          hitType: 'hit',
          tick: false,
          multistrike: false,
          x: 55,
          y: 66,
        } as WCLEvent,
        testConfig,
      )

      expect(state.getActor({ id: 1, instanceId: 0 })?.position).toEqual({
        x: 55,
        y: 66,
      })
    })
  })

  describe('engine lifecycle state', () => {
    it('marks actors dead on death and alive on cast activity', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 100,
          type: 'death',
          sourceID: 25,
          sourceIsFriendly: false,
          targetID: 1,
          targetIsFriendly: true,
        },
        testConfig,
      )
      expect(state.isActorAlive({ id: 1 })).toBe(false)

      state.processEvent(
        {
          timestamp: 200,
          type: 'cast',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 25,
          targetIsFriendly: false,
          abilityGameID: 123,
        },
        testConfig,
      )
      expect(state.isActorAlive({ id: 1 })).toBe(true)
    })

    it('marks actors dead on overkill damage events', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        createDamageEvent({
          timestamp: 100,
          sourceID: 25,
          sourceIsFriendly: false,
          targetID: 1,
          targetIsFriendly: true,
          overkill: 350,
        }),
        testConfig,
      )

      expect(state.isActorAlive({ id: 1 })).toBe(false)
    })

    it('tracks alive state per actor instance', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 100,
          type: 'death',
          sourceID: 25,
          sourceIsFriendly: false,
          sourceInstance: 0,
          targetID: 1,
          targetIsFriendly: true,
          targetInstance: 2,
        },
        testConfig,
      )

      expect(state.isActorAlive({ id: 1, instanceId: 2 })).toBe(false)
      expect(state.isActorAlive({ id: 1, instanceId: 3 })).toBe(true)
    })
  })

  describe('target tracking', () => {
    it('tracks current and last target including instance', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 100,
          type: 'cast',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 1,
          abilityGameID: 111,
        },
        testConfig,
      )

      expect(state.getCurrentTarget({ id: 1 })).toEqual({
        targetId: 99,
        targetInstance: 1,
      })
      expect(state.getLastTarget({ id: 1 })).toBeNull()

      state.processEvent(
        {
          timestamp: 200,
          type: 'cast',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 2,
          abilityGameID: 222,
        },
        testConfig,
      )

      expect(state.getCurrentTarget({ id: 1 })).toEqual({
        targetId: 99,
        targetInstance: 2,
      })
      expect(state.getLastTarget({ id: 1 })).toEqual({
        targetId: 99,
        targetInstance: 1,
      })
    })

    it('ignores environment targets when tracking cast targets', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 100,
          type: 'cast',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: -1,
          targetIsFriendly: false,
          abilityGameID: 999,
        },
        testConfig,
      )

      expect(state.getCurrentTarget({ id: 1 })).toBeNull()
      expect(state.getLastTarget({ id: 1 })).toBeNull()
    })

    it('tracks targets separately per source actor instance', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.processEvent(
        {
          timestamp: 100,
          type: 'cast',
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 1,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 1,
          abilityGameID: 111,
        },
        testConfig,
      )

      state.processEvent(
        {
          timestamp: 200,
          type: 'cast',
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 2,
          targetID: 88,
          targetIsFriendly: false,
          targetInstance: 4,
          abilityGameID: 222,
        },
        testConfig,
      )

      expect(state.getCurrentTarget({ id: 1, instanceId: 1 })).toEqual({
        targetId: 99,
        targetInstance: 1,
      })
      expect(state.getCurrentTarget({ id: 1, instanceId: 2 })).toEqual({
        targetId: 88,
        targetInstance: 4,
      })
      expect(state.getLastTarget({ id: 1, instanceId: 1 })).toBeNull()
      expect(state.getLastTarget({ id: 1, instanceId: 2 })).toBeNull()
    })
  })

  describe('threat table queries', () => {
    it('returns configured fight enemies without scanning threat tables', () => {
      const state = new FightState(defaultActorMap, testConfig, [
        { id: 99, name: 'Feugen', instance: 0 },
        { id: 249, name: 'Stalagg', instance: 0 },
      ])

      expect(state.getFightEnemies()).toEqual([
        { id: 99, instanceId: 0 },
        { id: 249, instanceId: 0 },
      ])
    })
  })

  describe('cast aura implications', () => {
    it('infers cat form from rake cast when form aura event is missing', () => {
      const actorMap = createActorMap([
        { id: 3, name: 'Druid', class: 'druid' },
      ])
      const state = new FightState(actorMap, testConfig)

      state.processEvent(
        {
          timestamp: 100,
          type: 'cast',
          sourceID: 3,
          sourceIsFriendly: true,
          targetID: 99,
          targetIsFriendly: false,
          abilityGameID: TEST_SPELLS.RAKE,
        },
        testConfig,
      )

      expect(state.getAuras(3).has(TEST_SPELLS.CAT_FORM)).toBe(true)
    })

    it('uses cast implication to swap bear form to cat form via exclusivity', () => {
      const actorMap = createActorMap([
        { id: 3, name: 'Druid', class: 'druid' },
      ])
      const state = new FightState(actorMap, testConfig)

      state.processEvent(
        createApplyBuffEvent({
          timestamp: 0,
          sourceID: 3,
          sourceIsFriendly: true,
          targetID: 3,
          targetIsFriendly: true,
          abilityGameID: TEST_SPELLS.BEAR_FORM,
        }),
        testConfig,
      )

      state.processEvent(
        {
          timestamp: 100,
          type: 'cast',
          sourceID: 3,
          sourceIsFriendly: true,
          targetID: 99,
          targetIsFriendly: false,
          abilityGameID: TEST_SPELLS.RAKE,
        },
        testConfig,
      )

      expect(state.getAuras(3).has(TEST_SPELLS.BEAR_FORM)).toBe(false)
      expect(state.getAuras(3).has(TEST_SPELLS.CAT_FORM)).toBe(true)
    })
  })

  describe('direct aura operations', () => {
    it('setAura enforces exclusivity for matching aura sets', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.setAura(1, TEST_SPELLS.BATTLE_STANCE)
      expect(state.getAuras(1).has(TEST_SPELLS.BATTLE_STANCE)).toBe(true)

      state.setAura(1, TEST_SPELLS.DEFENSIVE_STANCE)

      expect(state.getAuras(1).has(TEST_SPELLS.BATTLE_STANCE)).toBe(false)
      expect(state.getAuras(1).has(TEST_SPELLS.DEFENSIVE_STANCE)).toBe(true)
    })

    it('removeAura removes an existing aura', () => {
      const state = new FightState(defaultActorMap, testConfig)

      state.setAura(1, TEST_SPELLS.DEFENSIVE_STANCE)
      expect(state.getAuras(1).has(TEST_SPELLS.DEFENSIVE_STANCE)).toBe(true)

      state.removeAura(1, TEST_SPELLS.DEFENSIVE_STANCE)
      expect(state.getAuras(1).has(TEST_SPELLS.DEFENSIVE_STANCE)).toBe(false)
    })
  })

  describe('cross-class exclusive auras', () => {
    it('applies paladin blessing exclusivity to warriors', () => {
      // Warrior (actor ID 1) receives paladin blessings
      const state = new FightState(defaultActorMap, testConfig)

      // Apply Blessing of Might to warrior
      state.processEvent(
        createApplyBuffEvent({
          timestamp: 0,
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          abilityGameID: TEST_SPELLS.BLESSING_OF_MIGHT,
        }),
        testConfig,
      )

      expect(state.getAuras(1).has(TEST_SPELLS.BLESSING_OF_MIGHT)).toBe(true)

      // Apply Blessing of Salvation - should remove Blessing of Might
      state.processEvent(
        createApplyBuffEvent({
          timestamp: 100,
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
          abilityGameID: TEST_SPELLS.BLESSING_OF_SALVATION,
        }),
        testConfig,
      )

      expect(state.getAuras(1).has(TEST_SPELLS.BLESSING_OF_MIGHT)).toBe(false)
      expect(state.getAuras(1).has(TEST_SPELLS.BLESSING_OF_SALVATION)).toBe(
        true,
      )
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
        createApplyBuffEvent({
          timestamp: 0,
          sourceID: 3,
          sourceIsFriendly: true,
          targetID: 3,
          targetIsFriendly: true,
          abilityGameID: TEST_SPELLS.BEAR_FORM,
        }),
        testConfig,
      )

      expect(state.getAuras(3).has(TEST_SPELLS.BEAR_FORM)).toBe(true)

      // Apply Cat Form - should remove Bear Form
      state.processEvent(
        createApplyBuffEvent({
          timestamp: 100,
          sourceID: 3,
          sourceIsFriendly: true,
          targetID: 3,
          targetIsFriendly: true,
          abilityGameID: TEST_SPELLS.CAT_FORM,
        }),
        testConfig,
      )

      expect(state.getAuras(3).has(TEST_SPELLS.BEAR_FORM)).toBe(false)
      expect(state.getAuras(3).has(TEST_SPELLS.CAT_FORM)).toBe(true)
    })
  })
})
