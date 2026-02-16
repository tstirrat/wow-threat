/**
 * Tests for TBC Paladin threat config deltas.
 */
import {
  createApplyBuffEvent,
  createDamageEvent,
  createMockActorContext,
  createResourceChangeEvent,
} from '@wcl-threat/shared'
import type { ThreatContext } from '@wcl-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, paladinConfig } from './paladin'

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
    event: createDamageEvent(),
    amount: 100,
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestPaladin', class: 'paladin' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...overrides,
  }
}

describe('tbc paladin config', () => {
  it('uses seal of righteousness rank 9 buff-or-damage threat behavior', () => {
    const formula = paladinConfig.abilities[Spells.SealOfRighteousnessR9]
    expect(formula).toBeDefined()

    const buffResult = assertDefined(
      formula!(
        createMockContext({
          event: createApplyBuffEvent(),
          amount: 999,
        }),
      ),
    )
    expect(buffResult.formula).toBe('58')
    expect(buffResult.value).toBe(58)
    expect(buffResult.splitAmongEnemies).toBe(false)

    const damageResult = assertDefined(
      formula!(
        createMockContext({
          event: createDamageEvent(),
          amount: 315,
        }),
      ),
    )
    expect(damageResult.formula).toBe('amt')
    expect(damageResult.value).toBe(315)
    expect(damageResult.splitAmongEnemies).toBe(false)

    const resourceChangeResult = formula!(
      createMockContext({
        event: createResourceChangeEvent(),
      }),
    )
    expect(resourceChangeResult).toBeUndefined()
  })

  it('does not register spiritual attunement as a paladin threat ability', () => {
    expect(paladinConfig.abilities[Spells.SpiritualAttunement]).toBeUndefined()
  })
})
