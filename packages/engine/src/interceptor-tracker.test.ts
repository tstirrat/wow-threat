/**
 * InterceptorTracker Tests
 */
import { createMockActorContext } from '@wow-threat/shared'
import { createDamageEvent, createHealEvent } from '@wow-threat/shared'
import {
  type EventInterceptor,
  type EventInterceptorContext,
} from '@wow-threat/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InterceptorTracker } from './interceptor-tracker'

// Mock actor context for tests
const mockActorContext = {
  ...createMockActorContext(),
  setAura: () => {},
  removeAura: () => {},
}

describe('InterceptorTracker', () => {
  let tracker: InterceptorTracker

  beforeEach(() => {
    tracker = new InterceptorTracker()
  })

  describe('install', () => {
    it('installs an interceptor and returns an ID', () => {
      const interceptor: EventInterceptor = () => ({ action: 'passthrough' })
      const id = tracker.install(interceptor, 1000)

      expect(id).toBe('interceptor-1')
      expect(tracker.getActiveCount()).toBe(1)
    })

    it('generates unique IDs for multiple interceptors', () => {
      const interceptor1: EventInterceptor = () => ({ action: 'passthrough' })
      const interceptor2: EventInterceptor = () => ({ action: 'passthrough' })

      const id1 = tracker.install(interceptor1, 1000)
      const id2 = tracker.install(interceptor2, 2000)

      expect(id1).toBe('interceptor-1')
      expect(id2).toBe('interceptor-2')
      expect(tracker.getActiveCount()).toBe(2)
    })
  })

  describe('runInterceptors', () => {
    it('runs all installed interceptors on an event', () => {
      const interceptor1: EventInterceptor = () => ({ action: 'passthrough' })
      const interceptor2: EventInterceptor = () => ({ action: 'skip' })

      tracker.install(interceptor1, 1000)
      tracker.install(interceptor2, 1000)

      const event = createDamageEvent({
        timestamp: 2000,
        sourceID: 1,
        targetID: 2,
        abilityGameID: 100,
        amount: 500,
      })

      const results = tracker.runInterceptors(event, 2000, mockActorContext)

      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({ action: 'passthrough' })
      expect(results[1]).toEqual({ action: 'skip' })
    })

    it('provides correct context to interceptors', () => {
      let receivedContext: EventInterceptorContext | undefined

      const interceptor: EventInterceptor = (event, ctx) => {
        receivedContext = ctx
        return { action: 'passthrough' }
      }

      tracker.install(interceptor, 1000)

      const event = createDamageEvent({ timestamp: 2500 })

      tracker.runInterceptors(event, 2500, mockActorContext)

      expect(receivedContext?.timestamp).toBe(2500)
      expect(receivedContext?.installedAt).toBe(1000)
      expect(receivedContext?.actors).toBe(mockActorContext)
      expect(typeof receivedContext?.uninstall).toBe('function')
      expect(typeof receivedContext?.setAura).toBe('function')
      expect(typeof receivedContext?.removeAura).toBe('function')
    })

    it('exposes safe aura mutation helpers to interceptors', () => {
      const setAura = vi.fn()
      const removeAura = vi.fn()
      const actorContext = {
        ...mockActorContext,
        setAura,
        removeAura,
      }

      const interceptor: EventInterceptor = (event, ctx) => {
        ctx.setAura(11, 2458)
        ctx.removeAura(11, 71)
        return { action: 'passthrough' }
      }

      tracker.install(interceptor, 1000)

      tracker.runInterceptors(
        createDamageEvent({ timestamp: 2000 }),
        2000,
        actorContext,
      )

      expect(setAura).toHaveBeenCalledWith(11, 2458)
      expect(removeAura).toHaveBeenCalledWith(11, 71)
    })

    it('allows interceptors to uninstall themselves', () => {
      const interceptor: EventInterceptor = (event, ctx) => {
        ctx.uninstall()
        return { action: 'passthrough' }
      }

      tracker.install(interceptor, 1000)
      expect(tracker.getActiveCount()).toBe(1)

      const event = createDamageEvent({ timestamp: 2000 })

      tracker.runInterceptors(event, 2000, mockActorContext)
      expect(tracker.getActiveCount()).toBe(0)
    })

    it('returns empty array when no interceptors are installed', () => {
      const event = createDamageEvent({ timestamp: 2000 })

      const results = tracker.runInterceptors(event, 2000, mockActorContext)
      expect(results).toEqual([])
    })
  })

  describe('clear', () => {
    it('removes all interceptors', () => {
      const interceptor: EventInterceptor = () => ({ action: 'passthrough' })

      tracker.install(interceptor, 1000)
      tracker.install(interceptor, 2000)
      expect(tracker.getActiveCount()).toBe(2)

      tracker.clear()
      expect(tracker.getActiveCount()).toBe(0)
    })
  })

  describe('event interceptor patterns', () => {
    it('supports charge-limited effects (like Misdirection)', () => {
      let chargesRemaining = 3

      const interceptor: EventInterceptor = (event, ctx) => {
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

      tracker.install(interceptor, 1000)

      // First charge
      let results = tracker.runInterceptors(
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
      results = tracker.runInterceptors(
        createDamageEvent({ timestamp: 3000, sourceID: 1 }),
        3000,
        mockActorContext,
      )
      expect(results[0]).toMatchObject({
        action: 'augment',
        threatRecipientOverride: 99,
      })
      expect(tracker.getActiveCount()).toBe(1)

      // Third charge - interceptor should uninstall
      results = tracker.runInterceptors(
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

      const interceptor: EventInterceptor = (event, ctx) => {
        if (ctx.timestamp - ctx.installedAt > DURATION_MS) {
          ctx.uninstall()
          return { action: 'passthrough' }
        }

        return { action: 'skip' }
      }

      tracker.install(interceptor, 1000)

      // Within duration - should skip
      let results = tracker.runInterceptors(
        createDamageEvent({ timestamp: 3000 }),
        3000,
        mockActorContext,
      )
      expect(results[0]).toEqual({ action: 'skip' })
      expect(tracker.getActiveCount()).toBe(1)

      // After duration - should passthrough and uninstall
      results = tracker.runInterceptors(
        createDamageEvent({ timestamp: 7000 }),
        7000,
        mockActorContext,
      )
      expect(results[0]).toEqual({ action: 'passthrough' })
      expect(tracker.getActiveCount()).toBe(0)
    })

    it('supports event filtering by type and source', () => {
      const interceptor: EventInterceptor = (event) => {
        if (event.type !== 'damage' || event.sourceID !== 5) {
          return { action: 'passthrough' }
        }

        return { action: 'skip' }
      }

      tracker.install(interceptor, 1000)

      // Damage from wrong source - passthrough
      let results = tracker.runInterceptors(
        createDamageEvent({ timestamp: 2000, sourceID: 1 }),
        2000,
        mockActorContext,
      )
      expect(results[0]).toEqual({ action: 'passthrough' })

      // Heal from correct source - passthrough
      results = tracker.runInterceptors(
        createHealEvent({ timestamp: 3000, sourceID: 5 }),
        3000,
        mockActorContext,
      )
      expect(results[0]).toEqual({ action: 'passthrough' })

      // Damage from correct source - skip
      results = tracker.runInterceptors(
        createDamageEvent({ timestamp: 4000, sourceID: 5 }),
        4000,
        mockActorContext,
      )
      expect(results[0]).toEqual({ action: 'skip' })
    })
  })
})
