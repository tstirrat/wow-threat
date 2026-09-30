/**
 * Unit tests for spell school color resolution helpers.
 */
import { describe, expect, it } from 'vitest'

import {
  resolveSpellSchoolColor,
  resolveSpellSchoolColorFromLabels,
} from './spell-school-colors'

describe('spell-school-colors', () => {
  it('resolves base school colors', () => {
    expect(resolveSpellSchoolColor('holy')).toBe('light-dark(#897300, #FFE680)')
    expect(resolveSpellSchoolColor('fire')).toBe('light-dark(#B95B00, #FF8000)')
  })

  it('resolves combo school colors from slash labels and aliases', () => {
    expect(resolveSpellSchoolColor('frost/shadow')).toBe(
      'light-dark(#347AAF, #80C6FF)',
    )
    expect(resolveSpellSchoolColor('shadow/frost')).toBe(
      'light-dark(#347AAF, #80C6FF)',
    )
    expect(resolveSpellSchoolColor('shadowfrost')).toBe(
      'light-dark(#347AAF, #80C6FF)',
    )
  })

  it('resolves combo school colors from label arrays', () => {
    expect(resolveSpellSchoolColorFromLabels(['frost', 'shadow'])).toBe(
      'light-dark(#347AAF, #80C6FF)',
    )
  })

  it('returns null for unknown schools', () => {
    expect(resolveSpellSchoolColor('')).toBeNull()
    expect(resolveSpellSchoolColor('unknown')).toBeNull()
    expect(resolveSpellSchoolColorFromLabels(['unknown'])).toBeNull()
  })
})

describe('spell-school light-theme contrast', () => {
  const toLinear = (value: number) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  const contrastOnWhite = (hex: string) => {
    const [r = 0, g = 0, b = 0] = [1, 3, 5].map((index) =>
      toLinear(Number.parseInt(hex.slice(index, index + 2), 16) / 255),
    )
    return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05)
  }

  it('keeps every school light variant at WCAG AA contrast on white', () => {
    const schools = [
      'physical',
      'holy',
      'fire',
      'nature',
      'frost',
      'shadow',
      'arcane',
      'holystrike',
      'flamestrike',
      'holyfire',
      'stormstrike',
      'holystorm',
      'firestorm',
      'froststrike',
      'holyfrost',
      'frostfire',
      'froststorm',
      'elemental',
      'shadowstrike',
      'shadowholy',
      'shadowflame',
      'shadowstorm',
      'shadowfrost',
      'spellstrike',
      'divine',
      'spellfire',
      'spellstorm',
      'spellfrost',
      'chimeric',
      'spellshadow',
      'chromatic',
      'magic',
      'chaos',
    ]

    for (const school of schools) {
      const light = /^light-dark\((#[0-9A-F]{6}),/i.exec(
        resolveSpellSchoolColor(school) ?? '',
      )?.[1]
      expect(light, school).toBeDefined()
      expect(contrastOnWhite(light ?? ''), school).toBeGreaterThanOrEqual(4.5)
    }
  })
})
