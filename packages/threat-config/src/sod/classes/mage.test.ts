/**
 * Season of Discovery Mage Threat Configuration Tests
 */
import { checkExists } from '@wow-threat/shared'
import { describe, expect, it } from 'vitest'

import { createDamageContext } from '../../test/helpers/context'
import { Spells, mageConfig } from './mage'

describe('sod mage config', () => {
  it('keeps talent modifiers school-scoped without spell-id overrides', () => {
    const burningSoulRank2 = mageConfig.auraModifiers[Spells.BurningSoulRank2]
    const result = checkExists(
      burningSoulRank2?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.FrostfireBolt,
        }),
      ),
    )

    expect(result.value).toBe(0.7)
    expect(result.spellIds).toBeUndefined()
  })
})
