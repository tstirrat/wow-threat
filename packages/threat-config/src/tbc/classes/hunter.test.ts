/**
 * Tests for TBC Hunter Threat Configuration
 */
import {
  createCastEvent,
  createDamageEvent,
  createHealEvent,
  createMockActorContext,
} from '@wcl-threat/shared'
import type {
  EventInterceptor,
  EventInterceptorContext,
  ThreatContext,
} from '@wcl-threat/shared/src/types'
import { describe, expect, it, vi } from 'vitest'

import { createCastContext } from '../../test/helpers/context'
import { Spells, hunterConfig } from './hunter'

const HunterDamageSpells = {
  AutoShot: 75,
  MultiShot: 2643,
  SerpentSting: 1978,
  ExplosiveTrapEffect: 13812,
} as const

function assertDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined()
  if (value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: createDamageEvent({ sourceID: 1, targetID: 2 }),
    amount: 100,
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestHunter', class: 'hunter' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...overrides,
  }
}

function createMockInterceptorContext(
  actors: ThreatContext['actors'],
  overrides: Partial<EventInterceptorContext> = {},
): EventInterceptorContext {
  return {
    timestamp: 2000,
    installedAt: 1000,
    actors,
    uninstall: vi.fn(),
    setAura: () => {},
    removeAura: () => {},
    ...overrides,
  }
}

function createMisdirectionHandler(
  options: {
    sourceActorId?: number
    targetAllyId?: number
    actors?: ThreatContext['actors']
  } = {},
): {
  handler: EventInterceptor
  actors: ThreatContext['actors']
} {
  const sourceActorId = options.sourceActorId ?? 1
  const targetAllyId = options.targetAllyId ?? 10
  const actors = options.actors ?? createMockActorContext()

  const formula = assertDefined(hunterConfig.abilities[Spells.Misdirection])
  const result = assertDefined(
    formula(
      createMockContext({
        actors,
        event: createCastEvent({
          sourceID: sourceActorId,
          targetID: targetAllyId,
          abilityGameID: Spells.Misdirection,
        }),
      }),
    ),
  )

  if (result.effects?.[0]?.type !== 'installInterceptor') {
    throw new Error('Expected installInterceptor effect')
  }

  return { handler: result.effects[0].interceptor, actors }
}

describe('tbc hunter config', () => {
  describe('distracting shot', () => {
    it('adds distracting shot rank 7', () => {
      const formula = hunterConfig.abilities[Spells.DistractingShotR7]!

      const result = assertDefined(
        formula?.(
          createCastContext({
            sourceID: 1,
            targetID: 10,
            abilityGameID: Spells.DistractingShotR7,
          }),
        ),
      )

      expect(result.formula).toBe('amt + 900')
      expect(result.value).toBe(900)
    })
  })

  describe('misdirection', () => {
    it('installs an interceptor for redirect behavior', () => {
      const formula = hunterConfig.abilities[Spells.Misdirection]
      const result = assertDefined(
        formula?.(
          createMockContext({
            event: createCastEvent({
              sourceID: 1,
              targetID: 10,
              abilityGameID: Spells.Misdirection,
            }),
          }),
        ),
      )

      expect(result.formula).toBe('0')
      expect(result.value).toBe(0)
      expect(result.effects?.[0]?.type).toBe('installInterceptor')
    })

    it('returns passthrough for non-damage events', () => {
      const { handler, actors } = createMisdirectionHandler()
      const interceptorCtx = createMockInterceptorContext(actors)

      const result = handler(
        createHealEvent({
          sourceID: 1,
          targetID: 2,
        }),
        interceptorCtx,
      )

      expect(result).toEqual({ action: 'passthrough' })
    })

    it('redirects direct hunter damage to the ally target', () => {
      const targetAllyId = 10
      const { handler, actors } = createMisdirectionHandler({ targetAllyId })
      const interceptorCtx = createMockInterceptorContext(actors)

      const result = handler(
        createDamageEvent({
          sourceID: 1,
          targetID: 2,
          abilityGameID: HunterDamageSpells.AutoShot,
          tick: false,
        }),
        interceptorCtx,
      )

      expect(result).toEqual({
        action: 'augment',
        threatRecipientOverride: targetAllyId,
      })
    })

    it('does not redirect when the ally target is dead, but still consumes charges', () => {
      const targetAllyId = 10
      const { handler, actors } = createMisdirectionHandler({
        targetAllyId,
        actors: createMockActorContext({
          isActorAlive: () => false,
        }),
      })
      const uninstall = vi.fn()
      const interceptorCtx = createMockInterceptorContext(actors, { uninstall })

      const damageEvent = createDamageEvent({
        sourceID: 1,
        targetID: 2,
        abilityGameID: HunterDamageSpells.AutoShot,
        tick: false,
      })

      expect(handler(damageEvent, interceptorCtx)).toEqual({
        action: 'passthrough',
      })
      expect(handler(damageEvent, interceptorCtx)).toEqual({
        action: 'passthrough',
      })
      expect(uninstall).not.toHaveBeenCalled()

      expect(handler(damageEvent, interceptorCtx)).toEqual({
        action: 'passthrough',
      })
      expect(uninstall).toHaveBeenCalledTimes(1)
    })

    it('ignores damage from other sources', () => {
      const { handler, actors } = createMisdirectionHandler({
        sourceActorId: 1,
      })
      const interceptorCtx = createMockInterceptorContext(actors)

      const result = handler(
        createDamageEvent({
          sourceID: 5,
          targetID: 2,
          abilityGameID: HunterDamageSpells.AutoShot,
          tick: false,
        }),
        interceptorCtx,
      )

      expect(result).toEqual({ action: 'passthrough' })
      expect(interceptorCtx.uninstall).not.toHaveBeenCalled()
    })

    it('expires after 30 seconds', () => {
      const { handler, actors } = createMisdirectionHandler()
      const uninstall = vi.fn()
      const withinDuration = createMockInterceptorContext(actors, {
        timestamp: 20000,
        installedAt: 1000,
        uninstall,
      })

      const withinResult = handler(
        createDamageEvent({
          sourceID: 1,
          targetID: 2,
          abilityGameID: HunterDamageSpells.AutoShot,
          tick: false,
        }),
        withinDuration,
      )

      expect(withinResult).toEqual({
        action: 'augment',
        threatRecipientOverride: 10,
      })
      expect(uninstall).not.toHaveBeenCalled()

      const afterDuration = createMockInterceptorContext(actors, {
        timestamp: 32000,
        installedAt: 1000,
        uninstall,
      })

      const afterResult = handler(
        createDamageEvent({
          sourceID: 1,
          targetID: 2,
          abilityGameID: HunterDamageSpells.AutoShot,
          tick: false,
        }),
        afterDuration,
      )

      expect(afterResult).toEqual({ action: 'passthrough' })
      expect(uninstall).toHaveBeenCalledTimes(1)
    })

    it('does not consume charges on periodic serpent sting damage', () => {
      const { handler, actors } = createMisdirectionHandler()
      const uninstall = vi.fn()
      const interceptorCtx = createMockInterceptorContext(actors, { uninstall })

      const periodicSerpentTick = createDamageEvent({
        sourceID: 1,
        targetID: 2,
        abilityGameID: HunterDamageSpells.SerpentSting,
        tick: true,
      })

      expect(handler(periodicSerpentTick, interceptorCtx)).toEqual({
        action: 'passthrough',
      })
      expect(uninstall).not.toHaveBeenCalled()

      const directDamage = createDamageEvent({
        sourceID: 1,
        targetID: 2,
        abilityGameID: HunterDamageSpells.AutoShot,
        tick: false,
      })

      expect(handler(directDamage, interceptorCtx)).toEqual({
        action: 'augment',
        threatRecipientOverride: 10,
      })
      expect(handler(directDamage, interceptorCtx)).toEqual({
        action: 'augment',
        threatRecipientOverride: 10,
      })
      expect(uninstall).not.toHaveBeenCalled()

      expect(handler(directDamage, interceptorCtx)).toEqual({
        action: 'augment',
        threatRecipientOverride: 10,
      })
      expect(uninstall).toHaveBeenCalledTimes(1)
    })

    it('consumes all charges when multi-shot lands 3 hits', () => {
      const { handler, actors } = createMisdirectionHandler()
      const uninstall = vi.fn()
      const interceptorCtx = createMockInterceptorContext(actors, { uninstall })

      const results = [2, 3, 4].map((targetID) =>
        handler(
          createDamageEvent({
            sourceID: 1,
            targetID,
            abilityGameID: HunterDamageSpells.MultiShot,
            tick: false,
          }),
          interceptorCtx,
        ),
      )

      expect(results).toEqual([
        { action: 'augment', threatRecipientOverride: 10 },
        { action: 'augment', threatRecipientOverride: 10 },
        { action: 'augment', threatRecipientOverride: 10 },
      ])
      expect(uninstall).toHaveBeenCalledTimes(1)
    })

    it('consumes only landed hits when multi-shot lands 2 hits', () => {
      const { handler, actors } = createMisdirectionHandler()
      const uninstall = vi.fn()
      const interceptorCtx = createMockInterceptorContext(actors, { uninstall })

      const firstHit = handler(
        createDamageEvent({
          sourceID: 1,
          targetID: 2,
          abilityGameID: HunterDamageSpells.MultiShot,
          tick: false,
        }),
        interceptorCtx,
      )
      const secondHit = handler(
        createDamageEvent({
          sourceID: 1,
          targetID: 3,
          abilityGameID: HunterDamageSpells.MultiShot,
          tick: false,
        }),
        interceptorCtx,
      )

      expect(firstHit).toEqual({
        action: 'augment',
        threatRecipientOverride: 10,
      })
      expect(secondHit).toEqual({
        action: 'augment',
        threatRecipientOverride: 10,
      })
      expect(uninstall).not.toHaveBeenCalled()

      const thirdDirectHit = handler(
        createDamageEvent({
          sourceID: 1,
          targetID: 4,
          abilityGameID: HunterDamageSpells.AutoShot,
          tick: false,
        }),
        interceptorCtx,
      )

      expect(thirdDirectHit).toEqual({
        action: 'augment',
        threatRecipientOverride: 10,
      })
      expect(uninstall).toHaveBeenCalledTimes(1)
    })

    it('redirects all initial explosive trap aoe hits even when more than 3 targets are hit', () => {
      const { handler, actors } = createMisdirectionHandler()
      const uninstall = vi.fn()
      const interceptorCtx = createMockInterceptorContext(actors, { uninstall })

      const initialHits = [2, 3, 4, 5, 6].map((targetID) =>
        handler(
          createDamageEvent({
            timestamp: 5000,
            sourceID: 1,
            targetID,
            abilityGameID: HunterDamageSpells.ExplosiveTrapEffect,
            tick: false,
          }),
          interceptorCtx,
        ),
      )

      expect(initialHits).toEqual([
        { action: 'augment', threatRecipientOverride: 10 },
        { action: 'augment', threatRecipientOverride: 10 },
        { action: 'augment', threatRecipientOverride: 10 },
        { action: 'augment', threatRecipientOverride: 10 },
        { action: 'augment', threatRecipientOverride: 10 },
      ])
      expect(uninstall).not.toHaveBeenCalled()

      const postWindowEvent = handler(
        createDamageEvent({
          timestamp: 5001,
          sourceID: 1,
          targetID: 2,
          abilityGameID: HunterDamageSpells.AutoShot,
          tick: false,
        }),
        interceptorCtx,
      )

      expect(postWindowEvent).toEqual({ action: 'passthrough' })
      expect(uninstall).toHaveBeenCalledTimes(1)
    })
  })
})
