/**
 * Tests for TBC Druid Threat Configuration
 */
import {
  createDamageEvent,
  createHealEvent,
  createMockActorContext,
} from '@wow-threat/shared'
import type { ThreatContext } from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, druidConfig } from './druid'

function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: createHealEvent({
      sourceID: 1,
      targetID: 2,
      abilityGameID: Spells.LifebloomFinalBloom,
      amount: 1000,
    }),
    amount: 1000,
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestDruid', class: 'druid' },
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

describe('tbc druid config', () => {
  describe('lifebloom final bloom', () => {
    it('registers a lifebloom final bloom formula', () => {
      expect(druidConfig.abilities[Spells.LifebloomFinalBloom]).toBeDefined()
    })

    it('attributes lifebloom final bloom threat to the heal target', () => {
      const formula = assertDefined(
        druidConfig.abilities[Spells.LifebloomFinalBloom],
      )
      const result = assertDefined(formula(createMockContext()))

      expect(result.value).toBe(500)
      expect(result.splitAmongEnemies).toBe(true)
      expect(result.threatRecipient).toBe('target')
    })

    it('only applies lifebloom final bloom formula to heal events', () => {
      const formula = assertDefined(
        druidConfig.abilities[Spells.LifebloomFinalBloom],
      )
      const result = formula(
        createMockContext({
          event: createDamageEvent({
            sourceID: 1,
            targetID: 2,
            abilityGameID: Spells.LifebloomFinalBloom,
            amount: 1000,
          }),
          amount: 1000,
        }),
      )

      expect(result).toBeUndefined()
    })
  })
})
