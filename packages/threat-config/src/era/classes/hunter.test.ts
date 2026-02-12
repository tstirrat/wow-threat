/**
 * Tests for Hunter Threat Configuration
 */
import { createMockActorContext } from '@wcl-threat/shared'
import type {
  EventInterceptorContext,
  ThreatContext,
} from '@wcl-threat/shared/src/types'
import { describe, expect, it, vi } from 'vitest'

import { Spells, hunterConfig } from './hunter'

function assertDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined()
  if (value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

// Mock ThreatContext factory
function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  const { spellSchoolMask, ...restOverrides } = overrides

  return {
    event: {
      type: 'damage',
      sourceID: 1,
      targetID: 2,
    } as ThreatContext['event'],
    amount: 100,
    spellSchoolMask: spellSchoolMask ?? 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestHunter', class: 'hunter' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...restOverrides,
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

describe('Hunter Config', () => {
  describe('abilities', () => {
    describe('Feign Death', () => {
      it('returns threat drop (0 multiplier)', () => {
        const formula = hunterConfig.abilities[Spells.FeignDeath]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = assertDefined(formula!(ctx))

        expect(result.effects?.[0]).toEqual({
          type: 'modifyThreat',
          multiplier: 0,
          target: 'all',
        })
      })
    })

    describe('Misdirection', () => {
      it('installs a handler that redirects threat', () => {
        const formula = hunterConfig.abilities[Spells.Misdirection]
        expect(formula).toBeDefined()

        const ctx = createMockContext({
          event: {
            type: 'cast',
            sourceID: 1,
            targetID: 10, // Target ally
          } as ThreatContext['event'],
        })

        const result = assertDefined(formula!(ctx))

        expect(result.formula).toBe('0')
        expect(result.value).toBe(0)
        expect(result.effects?.[0]?.type).toBe('installInterceptor')
        expect(result.effects?.[0]).toHaveProperty('interceptor')
      })

      it('handler returns passthrough for non-damage events', () => {
        const formula = hunterConfig.abilities[Spells.Misdirection]
        const ctx = createMockContext({
          event: {
            type: 'cast',
            sourceID: 1,
            targetID: 10,
          } as ThreatContext['event'],
        })

        const result = assertDefined(formula!(ctx))
        if (result.effects?.[0]?.type !== 'installInterceptor') {
          throw new Error('Expected installInterceptor special type')
        }

        const handler = result.effects?.[0]?.interceptor
        const mockContext = createMockInterceptorContext(ctx.actors)

        // Handler should pass through heal events
        const healEvent = { type: 'heal', sourceID: 1, targetID: 2 }
        const healResult = handler(
          healEvent as ThreatContext['event'],
          mockContext,
        )
        expect(healResult).toEqual({ action: 'passthrough' })
      })

      it('handler redirects damage from correct source', () => {
        const formula = hunterConfig.abilities[Spells.Misdirection]
        const targetAllyId = 10

        const ctx = createMockContext({
          event: {
            type: 'cast',
            sourceID: 1,
            targetID: targetAllyId,
          } as ThreatContext['event'],
        })

        const result = assertDefined(formula!(ctx))
        if (result.effects?.[0]?.type !== 'installInterceptor') {
          throw new Error('Expected installInterceptor special type')
        }

        const handler = result.effects?.[0]?.interceptor
        const mockContext = createMockInterceptorContext(ctx.actors)

        // Handler should redirect damage from hunter (ID 1) to target ally (ID 10)
        const damageEvent = { type: 'damage', sourceID: 1, targetID: 2 }
        const damageResult = handler(
          damageEvent as ThreatContext['event'],
          mockContext,
        )
        expect(damageResult).toEqual({
          action: 'augment',
          threatRecipientOverride: targetAllyId,
        })
      })

      it('does not redirect when target ally is dead', () => {
        const formula = hunterConfig.abilities[Spells.Misdirection]
        const targetAllyId = 10

        const ctx = createMockContext({
          event: {
            type: 'cast',
            sourceID: 1,
            targetID: targetAllyId,
          } as ThreatContext['event'],
          actors: createMockActorContext({
            isActorAlive: (actor) => actor.id !== targetAllyId,
          }),
        })

        const result = assertDefined(formula!(ctx))
        if (result.effects?.[0]?.type !== 'installInterceptor') {
          throw new Error('Expected installInterceptor special type')
        }

        const handler = result.effects?.[0]?.interceptor
        const mockContext = createMockInterceptorContext(ctx.actors)

        const damageEvent = { type: 'damage', sourceID: 1, targetID: 2 }
        const damageResult = handler(
          damageEvent as ThreatContext['event'],
          mockContext,
        )
        expect(damageResult).toEqual({ action: 'passthrough' })
      })

      it('consumes charges even when target ally is dead', () => {
        const formula = hunterConfig.abilities[Spells.Misdirection]
        const targetAllyId = 10

        const ctx = createMockContext({
          event: {
            type: 'cast',
            sourceID: 1,
            targetID: targetAllyId,
          } as ThreatContext['event'],
          actors: createMockActorContext({
            isActorAlive: () => false,
          }),
        })

        const result = assertDefined(formula!(ctx))
        if (result.effects?.[0]?.type !== 'installInterceptor') {
          throw new Error('Expected installInterceptor special type')
        }

        const handler = result.effects?.[0]?.interceptor
        const uninstallMock = vi.fn()
        const mockContext = createMockInterceptorContext(ctx.actors, {
          uninstall: uninstallMock,
        })

        const damageEvent = { type: 'damage', sourceID: 1, targetID: 2 }

        handler(damageEvent as ThreatContext['event'], mockContext)
        handler(damageEvent as ThreatContext['event'], mockContext)
        expect(uninstallMock).not.toHaveBeenCalled()

        handler(damageEvent as ThreatContext['event'], mockContext)
        expect(uninstallMock).toHaveBeenCalledTimes(1)
      })

      it('handler does not redirect damage from other sources', () => {
        const formula = hunterConfig.abilities[Spells.Misdirection]
        const hunterSourceId = 1
        const targetAllyId = 10
        const otherSourceId = 5

        const ctx = createMockContext({
          event: {
            type: 'cast',
            sourceID: hunterSourceId,
            targetID: targetAllyId,
          } as ThreatContext['event'],
        })

        const result = assertDefined(formula!(ctx))
        if (result.effects?.[0]?.type !== 'installInterceptor') {
          throw new Error('Expected installInterceptor special type')
        }

        const handler = result.effects?.[0]?.interceptor
        const mockContext = createMockInterceptorContext(ctx.actors)

        // Damage from a different source should pass through unchanged
        const otherSourceDamage = {
          type: 'damage',
          sourceID: otherSourceId,
          targetID: 2,
        }
        const result2 = handler(
          otherSourceDamage as ThreatContext['event'],
          mockContext,
        )
        expect(result2).toEqual({ action: 'passthrough' })
        expect(mockContext.uninstall).not.toHaveBeenCalled()
      })

      it('handler only counts damage from the source hunter', () => {
        const formula = hunterConfig.abilities[Spells.Misdirection]
        const hunterSourceId = 1
        const otherSourceId = 5

        const ctx = createMockContext({
          event: {
            type: 'cast',
            sourceID: hunterSourceId,
            targetID: 10,
          } as ThreatContext['event'],
        })

        const result = assertDefined(formula!(ctx))
        if (result.effects?.[0]?.type !== 'installInterceptor') {
          throw new Error('Expected installInterceptor special type')
        }

        const handler = result.effects?.[0]?.interceptor
        const uninstallMock = vi.fn()
        const mockContext = createMockInterceptorContext(ctx.actors, {
          uninstall: uninstallMock,
        })

        const hunterDamage = {
          type: 'damage',
          sourceID: hunterSourceId,
          targetID: 2,
        }
        const otherDamage = {
          type: 'damage',
          sourceID: otherSourceId,
          targetID: 2,
        }

        // Other source damage (1st event from another source)
        handler(otherDamage as ThreatContext['event'], mockContext)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Hunter damage (1st event from hunter)
        handler(hunterDamage as ThreatContext['event'], mockContext)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Other source damage (2nd event from another source)
        handler(otherDamage as ThreatContext['event'], mockContext)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Hunter damage (2nd event from hunter)
        handler(hunterDamage as ThreatContext['event'], mockContext)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Other source damage (3rd event from another source)
        handler(otherDamage as ThreatContext['event'], mockContext)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Hunter damage (3rd event from hunter - should uninstall)
        handler(hunterDamage as ThreatContext['event'], mockContext)
        expect(uninstallMock).toHaveBeenCalled()
      })

      it('handler expires after 3 damage events', () => {
        const formula = hunterConfig.abilities[Spells.Misdirection]
        const ctx = createMockContext({
          event: {
            type: 'cast',
            sourceID: 1,
            targetID: 10,
          } as ThreatContext['event'],
        })

        const result = assertDefined(formula!(ctx))
        if (result.effects?.[0]?.type !== 'installInterceptor') {
          throw new Error('Expected installInterceptor special type')
        }

        const handler = result.effects?.[0]?.interceptor
        const uninstallMock = vi.fn()
        const mockContext = createMockInterceptorContext(ctx.actors, {
          uninstall: uninstallMock,
        })

        const damageEvent = { type: 'damage', sourceID: 1, targetID: 2 }

        // First charge
        handler(damageEvent as ThreatContext['event'], mockContext)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Second charge
        handler(damageEvent as ThreatContext['event'], mockContext)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Third charge - should uninstall
        handler(damageEvent as ThreatContext['event'], mockContext)
        expect(uninstallMock).toHaveBeenCalled()
      })

      it('handler expires after 30 seconds', () => {
        const formula = hunterConfig.abilities[Spells.Misdirection]
        const ctx = createMockContext({
          event: {
            type: 'cast',
            sourceID: 1,
            targetID: 10,
          } as ThreatContext['event'],
        })

        const result = assertDefined(formula!(ctx))
        if (result.effects?.[0]?.type !== 'installInterceptor') {
          throw new Error('Expected installInterceptor special type')
        }

        const handler = result.effects?.[0]?.interceptor
        const uninstallMock = vi.fn()

        // Within 30 seconds
        const withinWindowContext = createMockInterceptorContext(ctx.actors, {
          timestamp: 20000,
          installedAt: 1000,
          uninstall: uninstallMock,
        })

        const damageEvent = { type: 'damage', sourceID: 1, targetID: 2 }
        const withinResult = handler(
          damageEvent as ThreatContext['event'],
          withinWindowContext,
        )
        expect(withinResult).toEqual({
          action: 'augment',
          threatRecipientOverride: 10,
        })
        expect(uninstallMock).not.toHaveBeenCalled()

        // After 30 seconds
        const afterWindowContext = createMockInterceptorContext(ctx.actors, {
          timestamp: 32000,
          installedAt: 1000,
          uninstall: uninstallMock,
        })

        const afterResult = handler(
          damageEvent as ThreatContext['event'],
          afterWindowContext,
        )
        expect(afterResult).toEqual({ action: 'passthrough' })
        expect(uninstallMock).toHaveBeenCalled()
      })
    })

    describe('Distracting Shot', () => {
      it('returns threat with damage multiplier and bonus', () => {
        const formula = hunterConfig.abilities[Spells.DistractingShotR1]
        expect(formula).toBeDefined()

        const ctx = createMockContext({ amount: 100 })
        const result = assertDefined(formula!(ctx))

        expect(result.formula).toBe('amt + 110')
        expect(result.value).toBe(210) // 100 * 1 + 110
      })
    })

    describe('Disengage', () => {
      it('returns negative threat', () => {
        const formula = hunterConfig.abilities[Spells.DisengageR1]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = assertDefined(formula!(ctx))

        expect(result.formula).toBe('-140')
        expect(result.value).toBe(-140)
      })
    })
  })
})
