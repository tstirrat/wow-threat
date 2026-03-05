/**
 * Tests for TBC Shaman Threat Configuration
 */
import {
  createDamageEvent,
  createHealEvent,
  createMockActorContext,
} from '@wow-threat/shared'
import type { ThreatContext } from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, shamanConfig } from './shaman'

function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: createHealEvent({
      sourceID: 1,
      targetID: 2,
      abilityGameID: Spells.EarthShieldHeal,
      amount: 1000,
    }),
    amount: 1000,
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestShaman', class: 'shaman' },
    targetActor: { id: 2, name: 'TestTank', class: 'warrior' },
    encounterId: null,
    actors: createMockActorContext(),
    ...overrides,
  }
}

function assertDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined()
  if (value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

describe('tbc shaman config', () => {
  describe('earth shield', () => {
    it('registers an earth shield heal formula', () => {
      expect(shamanConfig.abilities[Spells.EarthShieldHeal]).toBeDefined()
    })

    it('attributes earth shield threat to the heal target', () => {
      const formula = assertDefined(
        shamanConfig.abilities[Spells.EarthShieldHeal],
      )
      const result = assertDefined(formula(createMockContext()))

      expect(result.value).toBe(500)
      expect(result.splitAmongEnemies).toBe(true)
      expect(result.threatRecipient).toBe('target')
    })

    it('only applies earth shield formula to heal events', () => {
      const formula = assertDefined(
        shamanConfig.abilities[Spells.EarthShieldHeal],
      )
      const result = formula(
        createMockContext({
          event: createDamageEvent({
            sourceID: 1,
            targetID: 2,
            abilityGameID: Spells.EarthShieldHeal,
            amount: 1000,
          }),
          amount: 1000,
        }),
      )

      expect(result).toBeUndefined()
    })
  })
})
