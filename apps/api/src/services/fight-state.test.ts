/**
 * Tests for FightState
 *
 * Verifies event dispatching to per-actor trackers, combatant info processing,
 * and gear implications coordination.
 */

import { describe, it, expect } from 'vitest'
import type { WCLEvent } from '@wcl-threat/wcl-types'
import type { ThreatConfig, Actor } from '@wcl-threat/threat-config'
import { anniversaryConfig } from '@wcl-threat/threat-config'

import { FightState } from './fight-state'

// ============================================================================
// Test Helpers
// ============================================================================

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
  gearImplications: NonNullable<
    NonNullable<ThreatConfig['classes']['warrior']>['gearImplications']
  >,
): ThreatConfig {
  return {
    ...anniversaryConfig,
    classes: {
      ...anniversaryConfig.classes,
      warrior: {
        ...anniversaryConfig.classes.warrior!,
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
      const state = new FightState(defaultActorMap)

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
        anniversaryConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(true)
      expect(state.getAuras(2).size).toBe(0)
    })

    it('routes removebuff to target actor aura tracker', () => {
      const state = new FightState(defaultActorMap)

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
        anniversaryConfig,
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
        anniversaryConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(false)
    })

    it('routes applydebuff to target actor', () => {
      const state = new FightState(defaultActorMap)

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
        anniversaryConfig,
      )

      expect(state.getAuras(25).has(12345)).toBe(true)
    })

    it('routes removedebuff to target actor', () => {
      const state = new FightState(defaultActorMap)

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
        anniversaryConfig,
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
        anniversaryConfig,
      )

      expect(state.getAuras(25).has(12345)).toBe(false)
    })

    it('ignores non-aura, non-combatantinfo events', () => {
      const state = new FightState(defaultActorMap)

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
        anniversaryConfig,
      )

      expect(state.getAuras(1).size).toBe(0)
      expect(state.getAuras(25).size).toBe(0)
    })

    it('returns empty set for unknown actors', () => {
      const state = new FightState(defaultActorMap)

      expect(state.getAuras(999).size).toBe(0)
    })
  })

  describe('combatantinfo processing', () => {
    it('seeds initial auras from combatant info', () => {
      const state = new FightState(defaultActorMap)

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
        anniversaryConfig,
      )

      expect(state.getAuras(1).has(71)).toBe(true)
      expect(state.getAuras(1).has(25780)).toBe(true)
    })

    it('stores gear from combatant info', () => {
      const state = new FightState(defaultActorMap)
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
        anniversaryConfig,
      )

      expect(state.getGear(1)).toEqual(gear)
    })

    it('handles combatant info with no auras or gear', () => {
      const state = new FightState(defaultActorMap)

      state.processEvent(
        {
          timestamp: 0,
          type: 'combatantinfo',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 1,
          targetIsFriendly: true,
        } as WCLEvent,
        anniversaryConfig,
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

      const state = new FightState(defaultActorMap)

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
      const state = new FightState(defaultActorMap)

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
        anniversaryConfig,
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

      const state = new FightState(actorMap)

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
      const state = new FightState(defaultActorMap)

      expect(state.getActorState(999)).toBeUndefined()
    })

    it('returns actor state after an event is processed', () => {
      const state = new FightState(defaultActorMap)

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
        anniversaryConfig,
      )

      const actorState = state.getActorState(1)
      expect(actorState).toBeDefined()
      expect(actorState!.auras.has(71)).toBe(true)
    })
  })
})
