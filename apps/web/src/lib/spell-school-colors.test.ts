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
    expect(resolveSpellSchoolColor('holy')).toBe('#FFE680')
    expect(resolveSpellSchoolColor('fire')).toBe('#FF8000')
  })

  it('resolves combo school colors from slash labels and aliases', () => {
    expect(resolveSpellSchoolColor('frost/shadow')).toBe('#80C6FF')
    expect(resolveSpellSchoolColor('shadow/frost')).toBe('#80C6FF')
    expect(resolveSpellSchoolColor('shadowfrost')).toBe('#80C6FF')
  })

  it('resolves combo school colors from label arrays', () => {
    expect(resolveSpellSchoolColorFromLabels(['frost', 'shadow'])).toBe(
      '#80C6FF',
    )
  })

  it('returns null for unknown schools', () => {
    expect(resolveSpellSchoolColor('')).toBeNull()
    expect(resolveSpellSchoolColor('unknown')).toBeNull()
    expect(resolveSpellSchoolColorFromLabels(['unknown'])).toBeNull()
  })
})
