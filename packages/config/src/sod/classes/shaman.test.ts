/**
 * Season of Discovery Shaman Threat Configuration Tests
 */
import { checkExists } from '@wow-threat/shared'
import type { GearItem } from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import {
  createApplyDebuffContext,
  createDamageContext,
} from '../../test/helpers/context'
import { Spells, shamanConfig } from './shaman'

describe('sod shaman config', () => {
  it('adds molten blast threat modifier', () => {
    const formula = shamanConfig.abilities[Spells.MoltenBlast]
    const result = checkExists(
      formula?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.MoltenBlast,
        }),
      ),
    )

    expect(result.value).toBe(200)
  })

  it('adds spirit of the alpha and loyal beta modifiers', () => {
    const spiritOfTheAlphaModifier =
      shamanConfig.auraModifiers[Spells.SpiritOfTheAlpha]
    const loyalBetaModifier = shamanConfig.auraModifiers[Spells.LoyalBeta]

    const spiritOfTheAlphaResult = checkExists(
      spiritOfTheAlphaModifier?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: 1,
        }),
      ),
    )
    const loyalBetaResult = checkExists(
      loyalBetaModifier?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: 1,
        }),
      ),
    )

    expect(spiritOfTheAlphaResult.value).toBe(1.45)
    expect(loyalBetaResult.value).toBe(0.7)
  })

  it('applies TAQ tank and way of earth conditionals', () => {
    const taqTank4pcModifier = shamanConfig.auraModifiers[Spells.TAQ_Tank_4pc]
    const wayOfEarthModifier = shamanConfig.auraModifiers[Spells.WayOfEarth]

    const taqTankWithoutAlpha = checkExists(
      taqTank4pcModifier?.(
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
          new Set([Spells.TAQ_Tank_4pc]),
        ),
      ),
    )
    const taqTankWithAlpha = checkExists(
      taqTank4pcModifier?.(
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
          new Set([Spells.TAQ_Tank_4pc, Spells.SpiritOfTheAlpha]),
        ),
      ),
    )
    const wayOfEarthWithoutActivate = checkExists(
      wayOfEarthModifier?.(
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
          new Set([Spells.WayOfEarth]),
        ),
      ),
    )
    const wayOfEarthWithActivate = checkExists(
      wayOfEarthModifier?.(
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
          new Set([Spells.WayOfEarth, Spells.ActivateWayOfEarth]),
        ),
      ),
    )

    expect(taqTankWithoutAlpha.value).toBe(1)
    expect(taqTankWithAlpha.value).toBe(1.2)
    expect(wayOfEarthWithoutActivate.value).toBe(1)
    expect(wayOfEarthWithActivate.value).toBe(1.65)
  })

  it('adds earth shock taunt handling and fixate tracking', () => {
    const formula = shamanConfig.abilities[Spells.EarthShockTaunt]
    const result = checkExists(
      formula?.(
        createApplyDebuffContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.EarthShockTaunt,
        }),
      ),
    )

    expect(result.spellModifier).toEqual({
      type: 'spell',
      value: 2,
    })
    expect(result.effects?.[0]?.type).toBe('customThreat')
    expect(shamanConfig.fixateBuffs?.has(Spells.EarthShockTaunt)).toBe(true)
  })

  it('adds aura implications and gear implications for sod additions', () => {
    const spiritImplications = shamanConfig.auraImplications?.get(
      Spells.SpiritOfTheAlpha,
    )
    expect(spiritImplications?.has(Spells.MoltenBlast)).toBe(true)

    const taqSetGear: GearItem[] = Array.from({ length: 4 }, (_, index) => ({
      id: index + 1,
      itemLevel: 1,
      setID: 1852,
    })) as GearItem[]
    const taqSetAuras = shamanConfig.gearImplications?.(taqSetGear) ?? []
    expect(taqSetAuras).toContain(Spells.TAQ_Tank_4pc)

    const enchantGear: GearItem[] = [
      {
        id: 10,
        itemLevel: 1,
        temporaryEnchant: 7683,
      } as GearItem,
      {
        id: 11,
        itemLevel: 1,
        temporaryEnchant: 7568,
      } as GearItem,
    ]
    const enchantAuras = shamanConfig.gearImplications?.(enchantGear) ?? []
    expect(enchantAuras).toContain(Spells.TAQ_Tank_4pc)
    expect(enchantAuras).toContain(Spells.ActivateWayOfEarth)
  })
})
