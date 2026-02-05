
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ThreatContext, ThreatConfig } from '../types'
import { getActiveModifiers, validateAuraModifiers, validateAbilities } from './utils'

// Mock context factory
function createMockContext(overrides: Partial<ThreatContext> = {}): ThreatContext {
  return {
    event: { type: 'damage', ability: { guid: 100 } } as any,
    amount: 100,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestPlayer', class: 'warrior' },
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
    expect(result[0]?.name).toBe('Mod1')
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
    expect(result[0]?.name).toBe('Mod1')
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

describe('validateAuraModifiers', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  // Mock config factory
  function createMockConfig(
    globalMods: Record<number, any> = {},
    classMods: Record<string, Record<number, any>> = {}
  ): ThreatConfig {
    const classes: any = {}
    for (const [className, mods] of Object.entries(classMods)) {
      classes[className] = {
        auraModifiers: mods,
        abilities: {},
      }
    }

    return {
      version: '1.0.0',
      gameVersion: 1,
      baseThreat: {} as any,
      classes,
      auraModifiers: globalMods,
      untauntableEnemies: new Set(),
    }
  }

  it('does not warn when all spell IDs are unique', () => {
    const config = createMockConfig(
      { 100: () => ({ name: 'Global1', value: 1.0, source: 'buff' as const }) },
      {
        warrior: { 200: () => ({ name: 'Warrior1', value: 1.0, source: 'buff' as const }) },
        paladin: { 300: () => ({ name: 'Paladin1', value: 1.0, source: 'buff' as const }) },
      }
    )

    validateAuraModifiers(config)

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('warns when spell ID exists in global and class config', () => {
    const config = createMockConfig(
      { 100: () => ({ name: 'Global1', value: 1.0, source: 'buff' as const }) },
      {
        warrior: { 100: () => ({ name: 'Warrior1', value: 1.0, source: 'buff' as const }) },
      }
    )

    validateAuraModifiers(config)

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate spell IDs found')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 100: global, warrior')
    )
  })

  it('warns when spell ID exists in multiple class configs', () => {
    const config = createMockConfig(
      {},
      {
        warrior: { 200: () => ({ name: 'Warrior1', value: 1.0, source: 'buff' as const }) },
        paladin: { 200: () => ({ name: 'Paladin1', value: 1.0, source: 'buff' as const }) },
      }
    )

    validateAuraModifiers(config)

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate spell IDs found')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 200: warrior, paladin')
    )
  })

  it('reports all duplicates found', () => {
    const config = createMockConfig(
      { 100: () => ({ name: 'Global1', value: 1.0, source: 'buff' as const }) },
      {
        warrior: {
          100: () => ({ name: 'Warrior1', value: 1.0, source: 'buff' as const }),
          200: () => ({ name: 'Warrior2', value: 1.0, source: 'buff' as const }),
        },
        paladin: {
          200: () => ({ name: 'Paladin1', value: 1.0, source: 'buff' as const }),
          300: () => ({ name: 'Paladin2', value: 1.0, source: 'buff' as const }),
        },
        druid: {
          300: () => ({ name: 'Druid1', value: 1.0, source: 'buff' as const }),
        },
      }
    )

    validateAuraModifiers(config)

    // Should report all 3 duplicates: 100, 200, 300
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate spell IDs found')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 100')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 200')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 300')
    )
  })

  it('handles empty class auraModifiers gracefully', () => {
    const config = createMockConfig(
      { 100: () => ({ name: 'Global1', value: 1.0, source: 'buff' as const }) },
      {
        warrior: {},
      }
    )

    validateAuraModifiers(config)

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })
})

describe('validateAbilities', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  // Mock config factory for abilities
  function createMockConfig(
    globalAbilities: Record<number, any> = {},
    classAbilities: Record<string, Record<number, any>> = {}
  ): ThreatConfig {
    const classes: any = {}
    for (const [className, abilities] of Object.entries(classAbilities)) {
      classes[className] = {
        abilities,
        auraModifiers: {},
      }
    }

    return {
      version: '1.0.0',
      gameVersion: 1,
      baseThreat: {} as any,
      classes,
      abilities: globalAbilities,
      auraModifiers: {},
      untauntableEnemies: new Set(),
    }
  }

  it('does not warn when all spell IDs are unique', () => {
    const config = createMockConfig(
      { 100: () => ({ formula: 'test', value: 100, splitAmongEnemies: false }) },
      {
        warrior: { 200: () => ({ formula: 'test', value: 200, splitAmongEnemies: false }) },
        paladin: { 300: () => ({ formula: 'test', value: 300, splitAmongEnemies: false }) },
      }
    )

    validateAbilities(config)

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('warns when spell ID exists in global and class config', () => {
    const config = createMockConfig(
      { 100: () => ({ formula: 'global', value: 100, splitAmongEnemies: false }) },
      {
        warrior: { 100: () => ({ formula: 'warrior', value: 100, splitAmongEnemies: false }) },
      }
    )

    validateAbilities(config)

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate spell IDs found in abilities')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 100: global, warrior')
    )
  })

  it('warns when spell ID exists in multiple class configs', () => {
    const config = createMockConfig(
      {},
      {
        warrior: { 200: () => ({ formula: 'warrior', value: 200, splitAmongEnemies: false }) },
        paladin: { 200: () => ({ formula: 'paladin', value: 200, splitAmongEnemies: false }) },
      }
    )

    validateAbilities(config)

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate spell IDs found in abilities')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 200: warrior, paladin')
    )
  })

  it('reports all duplicates found', () => {
    const config = createMockConfig(
      { 100: () => ({ formula: 'global', value: 100, splitAmongEnemies: false }) },
      {
        warrior: {
          100: () => ({ formula: 'warrior', value: 100, splitAmongEnemies: false }),
          200: () => ({ formula: 'warrior', value: 200, splitAmongEnemies: false }),
        },
        paladin: {
          200: () => ({ formula: 'paladin', value: 200, splitAmongEnemies: false }),
          300: () => ({ formula: 'paladin', value: 300, splitAmongEnemies: false }),
        },
        druid: {
          300: () => ({ formula: 'druid', value: 300, splitAmongEnemies: false }),
        },
      }
    )

    validateAbilities(config)

    // Should report all 3 duplicates: 100, 200, 300
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate spell IDs found in abilities')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 100')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 200')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 300')
    )
  })

  it('handles empty class abilities gracefully', () => {
    const config = createMockConfig(
      { 100: () => ({ formula: 'global', value: 100, splitAmongEnemies: false }) },
      {
        warrior: {},
      }
    )

    validateAbilities(config)

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('handles config with no global abilities', () => {
    const config: ThreatConfig = {
      version: '1.0.0',
      gameVersion: 1,
      baseThreat: {} as any,
      classes: {
        warrior: {
          abilities: { 100: () => ({ formula: 'warrior', value: 100, splitAmongEnemies: false }) },
          auraModifiers: {},
        },
      },
      auraModifiers: {},
      untauntableEnemies: new Set(),
    }

    validateAbilities(config)

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })
})
