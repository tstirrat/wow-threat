/**
 * Tests for ActorState
 *
 * Verifies position update routing and event-type eligibility rules.
 */
import {
  createCastEvent,
  createDamageEvent,
  createHealEvent,
  createResourceChangeEvent,
} from '@wcl-threat/shared'
import { describe, expect, it } from 'vitest'

import { ActorState, positionUpdateActorByEventType } from './actor-state'

describe('ActorState', () => {
  describe('position updates', () => {
    it('defines a source/target lookup for every event type', () => {
      expect(positionUpdateActorByEventType).toEqual(
        new Map([
          ['damage', 'target'],
          ['absorbed', 'target'],
          ['heal', 'target'],
          ['applybuff', 'target'],
          ['refreshbuff', 'target'],
          ['applybuffstack', 'target'],
          ['removebuff', 'target'],
          ['removebuffstack', 'target'],
          ['applydebuff', 'target'],
          ['refreshdebuff', 'target'],
          ['applydebuffstack', 'target'],
          ['removedebuff', 'target'],
          ['removedebuffstack', 'target'],
          ['energize', 'source'],
          ['resourcechange', 'source'],
          ['cast', 'source'],
          ['begincast', 'source'],
          ['interrupt', 'target'],
          ['death', 'target'],
          ['resurrect', 'target'],
          ['summon', 'source'],
          ['combatantinfo', 'source'],
        ]),
      )
    })

    it('updates position when event includes x/y coordinates', () => {
      const actor = new ActorState({
        profile: {
          id: 1,
          name: 'Warrior',
          class: 'warrior',
        },
        instanceId: 0,
      })

      expect(actor.getPosition()).toBeNull()

      const castEvent = createCastEvent({
        sourceID: 1,
        x: 100,
        y: 200,
      })
      expect(actor.updatePosition(castEvent)).toBe(true)
      expect(actor.getPosition()).toEqual({ x: 100, y: 200 })

      const damageEvent = createDamageEvent({
        sourceID: 1,
        x: 999,
        y: 888,
      })
      expect(actor.updatePosition(damageEvent)).toBe(true)
      expect(actor.getPosition()).toEqual({ x: 999, y: 888 })

      const resourceChangeEvent = createResourceChangeEvent({
        sourceID: 1,
        x: 110,
        y: 210,
      })
      expect(actor.updatePosition(resourceChangeEvent)).toBe(true)
      expect(actor.getPosition()).toEqual({ x: 110, y: 210 })

      const healEvent = createHealEvent({
        sourceID: 1,
        x: 777,
        y: 666,
      })
      expect(actor.updatePosition(healEvent)).toBe(true)
      expect(actor.getPosition()).toEqual({ x: 777, y: 666 })

      expect(
        actor.updatePosition(
          createCastEvent({
            sourceID: 1,
          }),
        ),
      ).toBe(false)
      expect(actor.getPosition()).toEqual({ x: 777, y: 666 })
    })
  })
})
