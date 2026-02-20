/**
 * Tests for SoD inheritance and composition from Era defaults.
 */
import { describe, expect, it } from 'vitest'

import { aq40AuraModifiers as eraAq40AuraModifiers } from '../era/raids/aq40'
import { naxxAbilities as eraNaxxAbilities } from '../era/raids/naxx'
import { onyxiaAbilities as eraOnyxiaAbilities } from '../era/raids/ony'
import { sodConfig } from './'
import { naxxAbilities as sodNaxxAbilities } from './raids/naxx'
import { onyxiaAbilities as sodOnyxiaAbilities } from './raids/onyxia'

describe('sod inheritance defaults', () => {
  it('shares onyxia abilities with era', () => {
    expect(sodOnyxiaAbilities).toBe(eraOnyxiaAbilities)
  })

  it('shares naxx abilities with era', () => {
    expect(sodNaxxAbilities).toBe(eraNaxxAbilities)
  })

  it('inherits era aq40 aura modifiers', () => {
    const fetishOfTheSandReaver = 26400
    expect(sodConfig.auraModifiers?.[fetishOfTheSandReaver]).toBe(
      eraAq40AuraModifiers[fetishOfTheSandReaver],
    )
  })

  it('keeps aq40 yauj fear in aggro-loss buffs', () => {
    const yaujFear = 26580
    expect(sodConfig.aggroLossBuffs?.has(yaujFear)).toBe(true)
  })
})
