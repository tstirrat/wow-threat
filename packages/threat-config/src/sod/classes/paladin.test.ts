/**
 * Season of Discovery Paladin Threat Configuration Tests
 */
import { checkExists } from '@wcl-threat/shared'
import type { GearItem } from '@wcl-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import {
  createCastContext,
  createDamageContext,
} from '../../test/helpers/context'
import { Spells, paladinConfig } from './paladin'

describe('sod paladin config', () => {
  it('infers hand of reckoning engraving from rune enchant', () => {
    const gear: GearItem[] = [
      {
        id: 1,
        itemLevel: 1,
        temporaryEnchant: 6844,
      } as GearItem,
    ]

    const auras = paladinConfig.gearImplications?.(gear) ?? []
    expect(auras).toContain(Spells.EngraveHandOfReckoning)
  })

  it('applies hand of reckoning conditional aura modifier and taunt fixate', () => {
    const engraveModifier =
      paladinConfig.auraModifiers[Spells.EngraveHandOfReckoning]
    const tauntFormula = paladinConfig.abilities[Spells.HandOfReckoning]

    const withoutRighteousFury = checkExists(
      engraveModifier?.(
        createDamageContext(
          {
            timestamp: 1000,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 99,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 1,
          },
          new Set([Spells.EngraveHandOfReckoning]),
        ),
      ),
    )
    const withRighteousFury = checkExists(
      engraveModifier?.(
        createDamageContext(
          {
            timestamp: 1000,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 99,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 1,
          },
          new Set([Spells.EngraveHandOfReckoning, Spells.RighteousFury]),
        ),
      ),
    )
    const tauntResult = checkExists(
      tauntFormula?.(
        createCastContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.HandOfReckoning,
        }),
      ),
    )

    expect(withoutRighteousFury.value).toBe(1)
    expect(withRighteousFury.value).toBe(1.5)
    expect(tauntResult.effects?.[0]?.type).toBe('customThreat')
    expect(paladinConfig.fixateBuffs?.has(Spells.HandOfReckoning)).toBe(true)
  })

  it('applies Improved Righteous Fury with SoD Righteous Fury aura ID', () => {
    const improvedRighteousFuryModifier =
      paladinConfig.auraModifiers[Spells.ImprovedRighteousFuryR3]
    const withRighteousFury = checkExists(
      improvedRighteousFuryModifier?.(
        createDamageContext(
          {
            timestamp: 1000,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 99,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: 1,
          },
          new Set([Spells.RighteousFury]),
        ),
      ),
    )

    expect(withRighteousFury.value).toBeCloseTo(1.1875, 6)
  })
})
