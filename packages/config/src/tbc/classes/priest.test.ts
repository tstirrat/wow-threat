/**
 * Tests for TBC Priest Threat Configuration
 */
import {
  createDamageEvent,
  createHealEvent,
  createMockActorContext,
} from '@wow-threat/shared'
import type { ThreatContext } from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, priestConfig } from './priest'

function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: createHealEvent({
      sourceID: 1,
      targetID: 2,
      abilityGameID: Spells.PrayerOfMending,
      amount: 1000,
    }),
    amount: 1000,
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestPriest', class: 'priest' },
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

describe('tbc priest config', () => {
  describe('prayer of mending', () => {
    it('registers a prayer of mending formula', () => {
      expect(priestConfig.abilities[Spells.PrayerOfMending]).toBeDefined()
    })

    it('attributes prayer of mending threat to the heal target', () => {
      const formula = assertDefined(
        priestConfig.abilities[Spells.PrayerOfMending],
      )
      const result = assertDefined(formula(createMockContext()))

      expect(result.value).toBe(500)
      expect(result.splitAmongEnemies).toBe(true)
      expect(result.threatRecipient).toBe('target')
    })

    it('only applies prayer of mending formula to heal events', () => {
      const formula = assertDefined(
        priestConfig.abilities[Spells.PrayerOfMending],
      )
      const result = formula(
        createMockContext({
          event: createDamageEvent({
            sourceID: 1,
            targetID: 2,
            abilityGameID: Spells.PrayerOfMending,
            amount: 1000,
          }),
          amount: 1000,
        }),
      )

      expect(result).toBeUndefined()
    })
  })
})
