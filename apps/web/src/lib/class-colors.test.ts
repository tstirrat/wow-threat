/**
 * Unit tests for class color resolution and CSS color utilities.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { ReportActorSummary } from '../types/api'
import {
  classColors,
  getActorColor,
  getClassColor,
  resolveCssColor,
} from './class-colors'

describe('getClassColor', () => {
  it('returns the CSS variable for Priest', () => {
    expect(getClassColor('Priest')).toBe('var(--foreground)')
  })

  it('returns the theme-aware CSS variable for Warrior', () => {
    expect(getClassColor('Warrior')).toBe('var(--class-warrior)')
  })

  it('returns same colors for all classes without special handling', () => {
    const classesWithoutVarColor = Object.keys(classColors).filter(
      (c) => c !== 'Priest',
    )
    for (const cls of classesWithoutVarColor) {
      expect(getClassColor(cls as Parameters<typeof getClassColor>[0])).toBe(
        classColors[cls as keyof typeof classColors],
      )
    }
  })

  it('returns fallback color for null class', () => {
    expect(getClassColor(null)).toBe('#94a3b8')
  })

  it('returns fallback color for undefined class', () => {
    expect(getClassColor(undefined)).toBe('#94a3b8')
  })
})

describe('getActorColor', () => {
  const makePlayer = (
    id: number,
    subType: 'Priest' | 'Warrior',
  ): ReportActorSummary => ({
    id,
    name: `Player-${id}`,
    type: 'Player',
    subType,
  })

  const emptyMap = new Map<number, ReportActorSummary>()

  it('returns CSS variable for Priest player', () => {
    const priest = makePlayer(1, 'Priest')
    expect(getActorColor(priest, emptyMap)).toBe('var(--foreground)')
  })

  it('returns the class CSS variable for Warrior player', () => {
    const warrior = makePlayer(1, 'Warrior')
    expect(getActorColor(warrior, emptyMap)).toBe('var(--class-warrior)')
  })

  it('resolves pet color from owner class', () => {
    const owner = makePlayer(1, 'Priest')
    const ownerMap = new Map([[1, owner]])
    const pet: ReportActorSummary = {
      id: 2,
      name: 'Minipet',
      type: 'Pet',
      petOwner: 1,
    }
    expect(getActorColor(pet, ownerMap)).toBe('var(--foreground)')
  })
})

describe('resolveCssColor', () => {
  it('returns non-var colors unchanged', () => {
    expect(resolveCssColor('#C79C6E')).toBe('#C79C6E')
    expect(resolveCssColor('rgb(200, 100, 50)')).toBe('rgb(200, 100, 50)')
  })

  it('resolves a CSS variable from document', () => {
    document.documentElement.style.setProperty('--test-color', '#abcdef')
    const result = resolveCssColor('var(--test-color)')
    expect(result).toBe('#abcdef')
    document.documentElement.style.removeProperty('--test-color')
  })

  it('returns the var() string as fallback when variable is not set', () => {
    const result = resolveCssColor('var(--not-a-real-variable)')
    expect(result).toBe('var(--not-a-real-variable)')
  })
})

describe('class color theme variables', () => {
  // Vitest runs from the web package root; CSS imports are stubbed in tests.
  const indexCss = readFileSync(path.resolve('src/index.css'), 'utf8')
  const [lightBlock = '', darkBlock = ''] = indexCss.split('.dark {')
  const classVariables = Object.values(classColors)
    .map((color) => /^var\((--class-[a-z-]+)\)$/.exec(color)?.[1])
    .filter((name) => name !== undefined)

  it('uses a class variable for every class except priest', () => {
    expect(classVariables).toHaveLength(Object.keys(classColors).length - 1)
  })

  it('defines every class variable in both light and dark themes', () => {
    for (const name of classVariables) {
      expect(lightBlock).toContain(`${name}:`)
      expect(darkBlock).toContain(`${name}:`)
    }
  })
})
