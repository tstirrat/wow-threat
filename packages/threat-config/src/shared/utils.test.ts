
import { describe, it, expect } from 'vitest'
import type { ThreatContext } from '../types'
import { getActiveModifiers } from './utils'

// Mock context factory
function createMockContext(overrides: Partial<ThreatContext> = {}): ThreatContext {
  return {
    event: { type: 'damage', ability: { guid: 100 } } as any,
    amount: 100,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    enemies: [],
    sourceActor: { id: 1, name: 'TestPlayer', class: 'warrior' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    ...overrides,
  }
}

describe('getActiveModifiers', () => {
  it('returns active modifiers based on source auras', () => {
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
    })

    const modifiers = {
      10: () => ({ name: 'Mod1', value: 1.1, source: 'buff' as const }),
      20: () => ({ name: 'Mod2', value: 1.2, source: 'buff' as const }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Mod1')
  })

  it('filters modifiers by spellIds if present - matched', () => {
    // Current event ability is 100
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
      event: { type: 'damage', ability: { guid: 100 } } as any
    })

    const modifiers = {
      10: () => ({ 
        name: 'Mod1', 
        value: 1.1, 
        source: 'buff' as const,
        spellIds: new Set([100, 101]) // Matches 100
      }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Mod1')
  })

  it('filters modifiers by spellIds if present - not matched', () => {
    // Current event ability is 100
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
      event: { type: 'damage', ability: { guid: 100 } } as any
    })

    const modifiers = {
      10: () => ({ 
        name: 'Mod1', 
        value: 1.1, 
        source: 'buff' as const,
        spellIds: new Set([102, 103]) // Does NOT match 100
      }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(0)
  })

  it('excludes modifiers with spellIds if event has no ability', () => {
    // Current event has no ability
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
      event: { type: 'energize' } as any // Energize might not have ability in this mock or some events
    })

    const modifiers = {
      10: () => ({ 
        name: 'Mod1', 
        value: 1.1, 
        source: 'buff' as const,
        spellIds: new Set([100])
      }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(0)
  })

  it('includes modifiers without spellIds regardless of event ability', () => {
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
      event: { type: 'damage', ability: { guid: 100 } } as any
    })

    const modifiers = {
      10: () => ({ 
        name: 'Mod1', 
        value: 1.1, 
        source: 'buff' as const
        // No spellIds
      }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(1)
  })
})
