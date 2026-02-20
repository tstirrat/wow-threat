/**
 * Season of Discovery Hunter Threat Configuration Tests
 */
import {
  checkExists,
  createCastEvent,
  createDamageEvent,
  createMockActorContext,
} from '@wow-threat/shared'
import type { ThreatContext } from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells, hunterConfig } from './hunter'

function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: createDamageEvent({ sourceID: 1, targetID: 99 }),
    amount: 100,
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestHunter', class: 'hunter' },
    targetActor: { id: 99, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...overrides,
  }
}

describe('sod hunter config', () => {
  it('adds ferocity aura modifier', () => {
    const ferocityModifier =
      hunterConfig.auraModifiers[Spells.S03T1HunterRanged2pc]
    const result = checkExists(
      ferocityModifier?.(
        createMockContext({
          event: createDamageEvent({
            timestamp: 1000,
            sourceID: 1,
            targetID: 99,
            abilityGameID: 1,
          }),
        }),
      ),
    )

    expect(result.value).toBe(2)
  })

  it('installs misdirection interceptor using tbc behavior', () => {
    const formula = checkExists(hunterConfig.abilities[Spells.Misdirection])
    const result = checkExists(
      formula(
        createMockContext({
          event: createCastEvent({
            sourceID: 1,
            targetID: 10,
            abilityGameID: Spells.Misdirection,
          }),
        }),
      ),
    )

    expect(result.formula).toBe('0')
    expect(result.value).toBe(0)
    expect(result.effects?.[0]?.type).toBe('installInterceptor')
  })
})
