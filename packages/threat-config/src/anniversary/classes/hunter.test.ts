/**
 * Tests for Hunter Threat Configuration
 */
import type { WCLEvent } from '@wcl-threat/wcl-types'
import { describe, expect, it, vi } from 'vitest'

import type { ThreatContext } from '../../types'
import { Spells, hunterConfig } from './hunter'

// Mock ThreatContext factory
function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: {
      type: 'damage',
      sourceID: 1,
      targetID: 2,
    } as ThreatContext['event'],
    amount: 100,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestHunter', class: 'hunter' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: {
      getPosition: () => null,
      getDistance: () => null,
      getActorsInRange: () => [],
      getThreat: () => 0,
      getTopActorsByThreat: () => [],
    },
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
        const result = formula!(ctx)

        expect(result.special).toEqual({ type: 'modifyThreat', multiplier: 0 })
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

        const result = formula!(ctx)

        expect(result.formula).toBe('0')
        expect(result.value).toBe(0)
        expect(result.special?.type).toBe('installHandler')
        expect(result.special).toHaveProperty('handler')
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

        const result = formula!(ctx)
        if (result.special?.type !== 'installHandler') {
          throw new Error('Expected installHandler special type')
        }

        const handler = result.special.handler
        const mockContext = {
          timestamp: 2000,
          installedAt: 1000,
          actors: ctx.actors,
          uninstall: vi.fn(),
        }

        // Handler should pass through heal events
        const healEvent = { type: 'heal', sourceID: 1, targetID: 2 }
        const healResult = handler(healEvent as any, mockContext as any)
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

        const result = formula!(ctx)
        if (result.special?.type !== 'installHandler') {
          throw new Error('Expected installHandler special type')
        }

        const handler = result.special.handler
        const mockContext = {
          timestamp: 2000,
          installedAt: 1000,
          actors: ctx.actors,
          uninstall: vi.fn(),
        }

        // Handler should redirect damage from hunter (ID 1) to target ally (ID 10)
        const damageEvent = { type: 'damage', sourceID: 1, targetID: 2 }
        const damageResult = handler(damageEvent as any, mockContext as any)
        expect(damageResult).toEqual({
          action: 'augment',
          threatRecipientOverride: targetAllyId,
        })
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

        const result = formula!(ctx)
        if (result.special?.type !== 'installHandler') {
          throw new Error('Expected installHandler special type')
        }

        const handler = result.special.handler
        const mockContext = {
          timestamp: 2000,
          installedAt: 1000,
          actors: ctx.actors,
          uninstall: vi.fn(),
        }

        // Damage from a different source should pass through unchanged
        const otherSourceDamage = {
          type: 'damage',
          sourceID: otherSourceId,
          targetID: 2,
        }
        const result2 = handler(otherSourceDamage as any, mockContext as any)
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

        const result = formula!(ctx)
        if (result.special?.type !== 'installHandler') {
          throw new Error('Expected installHandler special type')
        }

        const handler = result.special.handler
        const uninstallMock = vi.fn()
        const mockContext = {
          timestamp: 2000,
          installedAt: 1000,
          actors: ctx.actors,
          uninstall: uninstallMock,
        }

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
        handler(otherDamage as any, mockContext as any)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Hunter damage (1st event from hunter)
        handler(hunterDamage as any, mockContext as any)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Other source damage (2nd event from another source)
        handler(otherDamage as any, mockContext as any)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Hunter damage (2nd event from hunter)
        handler(hunterDamage as any, mockContext as any)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Other source damage (3rd event from another source)
        handler(otherDamage as any, mockContext as any)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Hunter damage (3rd event from hunter - should uninstall)
        handler(hunterDamage as any, mockContext as any)
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

        const result = formula!(ctx)
        if (result.special?.type !== 'installHandler') {
          throw new Error('Expected installHandler special type')
        }

        const handler = result.special.handler
        const uninstallMock = vi.fn()
        const mockContext = {
          timestamp: 2000,
          installedAt: 1000,
          actors: ctx.actors,
          uninstall: uninstallMock,
        }

        const damageEvent = { type: 'damage', sourceID: 1, targetID: 2 }

        // First charge
        handler(damageEvent as any, mockContext as any)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Second charge
        handler(damageEvent as any, mockContext as any)
        expect(uninstallMock).not.toHaveBeenCalled()

        // Third charge - should uninstall
        handler(damageEvent as any, mockContext as any)
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

        const result = formula!(ctx)
        if (result.special?.type !== 'installHandler') {
          throw new Error('Expected installHandler special type')
        }

        const handler = result.special.handler
        const uninstallMock = vi.fn()

        // Within 30 seconds
        const withinWindowContext = {
          timestamp: 20000,
          installedAt: 1000,
          actors: ctx.actors,
          uninstall: uninstallMock,
        }

        const damageEvent = { type: 'damage', sourceID: 1, targetID: 2 }
        const withinResult = handler(
          damageEvent as any,
          withinWindowContext as any,
        )
        expect(withinResult).toEqual({
          action: 'augment',
          threatRecipientOverride: 10,
        })
        expect(uninstallMock).not.toHaveBeenCalled()

        // After 30 seconds
        const afterWindowContext = {
          timestamp: 32000,
          installedAt: 1000,
          actors: ctx.actors,
          uninstall: uninstallMock,
        }

        const afterResult = handler(
          damageEvent as any,
          afterWindowContext as any,
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
        const result = formula!(ctx)

        expect(result.formula).toBe('amt + 110')
        expect(result.value).toBe(210) // 100 * 1 + 110
      })
    })

    describe('Disengage', () => {
      it('returns negative threat', () => {
        const formula = hunterConfig.abilities[Spells.DisengageR1]
        expect(formula).toBeDefined()

        const ctx = createMockContext()
        const result = formula!(ctx)

        expect(result.formula).toBe('-140')
        expect(result.value).toBe(-140)
      })
    })
  })
})
