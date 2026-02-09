/**
 * EffectTracker Tests
 */
import type { ActorContext, EffectHandler } from '@wcl-threat/threat-config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDamageEvent, createHealEvent } from '../../test/helpers/events'
import { EffectTracker } from './effect-tracker'

// Mock actor context for tests
const mockActorContext: ActorContext & {
  setAura: (actorId: number, spellId: number) => void
  removeAura: (actorId: number, spellId: number) => void
} = {
  getPosition: () => null,
  getDistance: () => null,
  getActorsInRange: () => [],
  getThreat: () => 0,
  getTopActorsByThreat: () => [],
  isActorAlive: () => true,
  getCurrentTarget: () => null,
  getLastTarget: () => null,
  setAura: () => {},
  removeAura: () => {},
}

describe('EffectTracker', () => {
  let tracker: EffectTracker

  beforeEach(() => {
    tracker = new EffectTracker()
  })

  describe('install', () => {
    it('installs a handler and returns an ID', () => {
      const handler: EffectHandler = () => ({ action: 'passthrough' })
      const id = tracker.install(handler, 1000)

      expect(id).toBe('handler-1')
      expect(tracker.getActiveCount()).toBe(1)
    })

    it('generates unique IDs for multiple handlers', () => {
      const handler1: EffectHandler = () => ({ action: 'passthrough' })
      const handler2: EffectHandler = () => ({ action: 'passthrough' })

      const id1 = tracker.install(handler1, 1000)
      const id2 = tracker.install(handler2, 2000)

      expect(id1).toBe('handler-1')
      expect(id2).toBe('handler-2')
      expect(tracker.getActiveCount()).toBe(2)
    })
  })

  describe('runHandlers', () => {
    it('runs all installed handlers on an event', () => {
      const handler1: EffectHandler = () => ({ action: 'passthrough' })
      const handler2: EffectHandler = () => ({ action: 'skip' })

      tracker.install(handler1, 1000)
      tracker.install(handler2, 1000)

      const event = createDamageEvent({
        timestamp: 2000,
        sourceID: 1,
        targetID: 2,
        abilityGameID: 100,
        amount: 500,
      })

      const results = tracker.runHandlers(event, 2000, mockActorContext)

      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({ action: 'passthrough' })
      expect(results[1]).toEqual({ action: 'skip' })
    })

    it('provides correct context to handlers', () => {
      let receivedContext: any

      const handler: EffectHandler = (event, ctx) => {
        receivedContext = ctx
        return { action: 'passthrough' }
      }

      tracker.install(handler, 1000)

      const event = createDamageEvent({ timestamp: 2500 })

      tracker.runHandlers(event, 2500, mockActorContext)

      expect(receivedContext.timestamp).toBe(2500)
      expect(receivedContext.installedAt).toBe(1000)
      expect(receivedContext.actors).toBe(mockActorContext)
      expect(typeof receivedContext.uninstall).toBe('function')
      expect(typeof receivedContext.setAura).toBe('function')
      expect(typeof receivedContext.removeAura).toBe('function')
    })

    it('exposes safe aura mutation helpers to handlers', () => {
      const setAura = vi.fn()
      const removeAura = vi.fn()
      const actorContext = {
        ...mockActorContext,
        setAura,
        removeAura,
      }

      const handler: EffectHandler = (event, ctx) => {
        ctx.setAura(11, 2458)
        ctx.removeAura(11, 71)
        return { action: 'passthrough' }
      }

      tracker.install(handler, 1000)

      tracker.runHandlers(createDamageEvent({ timestamp: 2000 }), 2000, actorContext)

      expect(setAura).toHaveBeenCalledWith(11, 2458)
      expect(removeAura).toHaveBeenCalledWith(11, 71)
    })

    it('allows handlers to uninstall themselves', () => {
      const handler: EffectHandler = (event, ctx) => {
        ctx.uninstall()
        return { action: 'passthrough' }
      }

      tracker.install(handler, 1000)
      expect(tracker.getActiveCount()).toBe(1)

      const event = createDamageEvent({ timestamp: 2000 })

      tracker.runHandlers(event, 2000, mockActorContext)
      expect(tracker.getActiveCount()).toBe(0)
    })

    it('returns empty array when no handlers are installed', () => {
      const event = createDamageEvent({ timestamp: 2000 })

      const results = tracker.runHandlers(event, 2000, mockActorContext)
      expect(results).toEqual([])
    })
  })

  describe('clear', () => {
    it('removes all handlers', () => {
      const handler: EffectHandler = () => ({ action: 'passthrough' })

      tracker.install(handler, 1000)
      tracker.install(handler, 2000)
      expect(tracker.getActiveCount()).toBe(2)

      tracker.clear()
      expect(tracker.getActiveCount()).toBe(0)
    })
  })

  describe('effect handler patterns', () => {
    it('supports charge-limited effects (like Misdirection)', () => {
      let chargesRemaining = 3

      const handler: EffectHandler = (event, ctx) => {
        if (event.type !== 'damage' || event.sourceID !== 1) {
          return { action: 'passthrough' }
        }

        chargesRemaining--
        if (chargesRemaining <= 0) {
          ctx.uninstall()
        }

        return {
          action: 'augment',
          threatRecipientOverride: 99,
        }
      }

      tracker.install(handler, 1000)

      // First charge
      let results = tracker.runHandlers(
        createDamageEvent({ timestamp: 2000, sourceID: 1 }),
        2000,
        mockActorContext,
      )
      expect(results[0]).toMatchObject({
        action: 'augment',
        threatRecipientOverride: 99,
      })
      expect(tracker.getActiveCount()).toBe(1)

      // Second charge
      results = tracker.runHandlers(
        createDamageEvent({ timestamp: 3000, sourceID: 1 }),
        3000,
        mockActorContext,
      )
      expect(results[0]).toMatchObject({
        action: 'augment',
        threatRecipientOverride: 99,
      })
      expect(tracker.getActiveCount()).toBe(1)

      // Third charge - handler should uninstall
      results = tracker.runHandlers(
        createDamageEvent({ timestamp: 4000, sourceID: 1 }),
        4000,
        mockActorContext,
      )
      expect(results[0]).toMatchObject({
        action: 'augment',
        threatRecipientOverride: 99,
      })
      expect(tracker.getActiveCount()).toBe(0)
    })

    it('supports time-limited effects', () => {
      const DURATION_MS = 5000

      const handler: EffectHandler = (event, ctx) => {
        if (ctx.timestamp - ctx.installedAt > DURATION_MS) {
          ctx.uninstall()
          return { action: 'passthrough' }
        }

        return { action: 'skip' }
      }

      tracker.install(handler, 1000)

      // Within duration - should skip
      let results = tracker.runHandlers(
        createDamageEvent({ timestamp: 3000 }),
        3000,
        mockActorContext,
      )
      expect(results[0]).toEqual({ action: 'skip' })
      expect(tracker.getActiveCount()).toBe(1)

      // After duration - should passthrough and uninstall
      results = tracker.runHandlers(
        createDamageEvent({ timestamp: 7000 }),
        7000,
        mockActorContext,
      )
      expect(results[0]).toEqual({ action: 'passthrough' })
      expect(tracker.getActiveCount()).toBe(0)
    })

    it('supports event filtering by type and source', () => {
      const handler: EffectHandler = (event, ctx) => {
        if (event.type !== 'damage' || event.sourceID !== 5) {
          return { action: 'passthrough' }
        }

        return { action: 'skip' }
      }

      tracker.install(handler, 1000)

      // Damage from wrong source - passthrough
      let results = tracker.runHandlers(
        createDamageEvent({ timestamp: 2000, sourceID: 1 }),
        2000,
        mockActorContext,
      )
      expect(results[0]).toEqual({ action: 'passthrough' })

      // Heal from correct source - passthrough
      results = tracker.runHandlers(
        createHealEvent({ timestamp: 3000, sourceID: 5 }),
        3000,
        mockActorContext,
      )
      expect(results[0]).toEqual({ action: 'passthrough' })

      // Damage from correct source - skip
      results = tracker.runHandlers(
        createDamageEvent({ timestamp: 4000, sourceID: 5 }),
        4000,
        mockActorContext,
      )
      expect(results[0]).toEqual({ action: 'skip' })
    })
  })
})
