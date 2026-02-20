import {
  type AuraModifierFn,
  type ThreatConfig,
  type ThreatFormula,
  type WowClass,
} from '@wow-threat/shared/src/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { validateAbilities, validateAuraModifiers } from './utils'

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
    globalMods: Record<number, AuraModifierFn> = {},
    classMods: Record<string, Record<number, AuraModifierFn>> = {},
  ): ThreatConfig {
    const classes: ThreatConfig['classes'] = {}
    for (const [className, mods] of Object.entries(classMods)) {
      classes[className as WowClass] = {
        auraModifiers: mods,
        abilities: {},
      }
    }

    return {
      version: '1.0.0',
      displayName: 'Test Config',
      wowhead: {
        domain: 'classic',
      },
      resolve: () => false,
      baseThreat: {} as ThreatConfig['baseThreat'],
      classes,
      auraModifiers: globalMods,
    }
  }

  it('does not warn when all spell IDs are unique', () => {
    const config = createMockConfig(
      { 100: () => ({ name: 'Global1', value: 1.0, source: 'buff' as const }) },
      {
        warrior: {
          200: () => ({
            name: 'Warrior1',
            value: 1.0,
            source: 'buff' as const,
          }),
        },
        paladin: {
          300: () => ({
            name: 'Paladin1',
            value: 1.0,
            source: 'buff' as const,
          }),
        },
      },
    )

    validateAuraModifiers(config)

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('warns when spell ID exists in global and class config', () => {
    const config = createMockConfig(
      { 100: () => ({ name: 'Global1', value: 1.0, source: 'buff' as const }) },
      {
        warrior: {
          100: () => ({
            name: 'Warrior1',
            value: 1.0,
            source: 'buff' as const,
          }),
        },
      },
    )

    validateAuraModifiers(config)

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate spell IDs found'),
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 100: global, warrior'),
    )
  })

  it('warns when spell ID exists in multiple class configs', () => {
    const config = createMockConfig(
      {},
      {
        warrior: {
          200: () => ({
            name: 'Warrior1',
            value: 1.0,
            source: 'buff' as const,
          }),
        },
        paladin: {
          200: () => ({
            name: 'Paladin1',
            value: 1.0,
            source: 'buff' as const,
          }),
        },
      },
    )

    validateAuraModifiers(config)

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate spell IDs found'),
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 200: warrior, paladin'),
    )
  })

  it('reports all duplicates found', () => {
    const config = createMockConfig(
      { 100: () => ({ name: 'Global1', value: 1.0, source: 'buff' as const }) },
      {
        warrior: {
          100: () => ({
            name: 'Warrior1',
            value: 1.0,
            source: 'buff' as const,
          }),
          200: () => ({
            name: 'Warrior2',
            value: 1.0,
            source: 'buff' as const,
          }),
        },
        paladin: {
          200: () => ({
            name: 'Paladin1',
            value: 1.0,
            source: 'buff' as const,
          }),
          300: () => ({
            name: 'Paladin2',
            value: 1.0,
            source: 'buff' as const,
          }),
        },
        druid: {
          300: () => ({ name: 'Druid1', value: 1.0, source: 'buff' as const }),
        },
      },
    )

    validateAuraModifiers(config)

    // Should report all 3 duplicates: 100, 200, 300
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate spell IDs found'),
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 100'),
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 200'),
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 300'),
    )
  })

  it('handles empty class auraModifiers gracefully', () => {
    const config = createMockConfig(
      { 100: () => ({ name: 'Global1', value: 1.0, source: 'buff' as const }) },
      {
        warrior: {},
      },
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
    globalAbilities: Record<number, ThreatFormula> = {},
    classAbilities: Record<string, Record<number, ThreatFormula>> = {},
  ): ThreatConfig {
    const classes: ThreatConfig['classes'] = {}
    for (const [className, abilities] of Object.entries(classAbilities)) {
      classes[className as WowClass] = {
        abilities,
        auraModifiers: {},
      }
    }

    return {
      version: '1.0.0',
      displayName: 'Test Config',
      wowhead: {
        domain: 'classic',
      },
      resolve: () => false,
      baseThreat: {} as ThreatConfig['baseThreat'],
      classes,
      abilities: globalAbilities,
      auraModifiers: {},
    }
  }

  it('does not warn when all spell IDs are unique', () => {
    const config = createMockConfig(
      {
        100: () => ({ formula: 'test', value: 100, splitAmongEnemies: false }),
      },
      {
        warrior: {
          200: () => ({
            formula: 'test',
            value: 200,
            splitAmongEnemies: false,
          }),
        },
        paladin: {
          300: () => ({
            formula: 'test',
            value: 300,
            splitAmongEnemies: false,
          }),
        },
      },
    )

    validateAbilities(config)

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('warns when spell ID exists in global and class config', () => {
    const config = createMockConfig(
      {
        100: () => ({
          formula: 'global',
          value: 100,
          splitAmongEnemies: false,
        }),
      },
      {
        warrior: {
          100: () => ({
            formula: 'warrior',
            value: 100,
            splitAmongEnemies: false,
          }),
        },
      },
    )

    validateAbilities(config)

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate spell IDs found in abilities'),
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 100: global, warrior'),
    )
  })

  it('warns when spell ID exists in multiple class configs', () => {
    const config = createMockConfig(
      {},
      {
        warrior: {
          200: () => ({
            formula: 'warrior',
            value: 200,
            splitAmongEnemies: false,
          }),
        },
        paladin: {
          200: () => ({
            formula: 'paladin',
            value: 200,
            splitAmongEnemies: false,
          }),
        },
      },
    )

    validateAbilities(config)

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate spell IDs found in abilities'),
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 200: warrior, paladin'),
    )
  })

  it('reports all duplicates found', () => {
    const config = createMockConfig(
      {
        100: () => ({
          formula: 'global',
          value: 100,
          splitAmongEnemies: false,
        }),
      },
      {
        warrior: {
          100: () => ({
            formula: 'warrior',
            value: 100,
            splitAmongEnemies: false,
          }),
          200: () => ({
            formula: 'warrior',
            value: 200,
            splitAmongEnemies: false,
          }),
        },
        paladin: {
          200: () => ({
            formula: 'paladin',
            value: 200,
            splitAmongEnemies: false,
          }),
          300: () => ({
            formula: 'paladin',
            value: 300,
            splitAmongEnemies: false,
          }),
        },
        druid: {
          300: () => ({
            formula: 'druid',
            value: 300,
            splitAmongEnemies: false,
          }),
        },
      },
    )

    validateAbilities(config)

    // Should report all 3 duplicates: 100, 200, 300
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate spell IDs found in abilities'),
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 100'),
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 200'),
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spell ID 300'),
    )
  })

  it('handles empty class abilities gracefully', () => {
    const config = createMockConfig(
      {
        100: () => ({
          formula: 'global',
          value: 100,
          splitAmongEnemies: false,
        }),
      },
      {
        warrior: {},
      },
    )

    validateAbilities(config)

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('handles config with no global abilities', () => {
    const config: ThreatConfig = {
      version: '1.0.0',
      displayName: 'Test Config',
      wowhead: {
        domain: 'classic',
      },
      resolve: () => false,
      baseThreat: {} as ThreatConfig['baseThreat'],
      classes: {
        warrior: {
          abilities: {
            100: () => ({
              formula: 'warrior',
              value: 100,
              splitAmongEnemies: false,
            }),
          },
          auraModifiers: {},
        },
      },
      auraModifiers: {},
    }

    validateAbilities(config)

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })
})
