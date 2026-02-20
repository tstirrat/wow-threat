/**
 * Season of Discovery Priest Threat Configuration Tests
 */
import { checkExists } from '@wow-threat/shared'
import type { GearItem } from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import { createDamageContext } from '../../test/helpers/context'
import { Buffs, priestConfig } from './priest'

describe('sod priest config', () => {
  it('adds se set threat reduction on mind blast', () => {
    const setModifier = priestConfig.auraModifiers[Buffs.SE_DPS_4pc]
    const result = checkExists(
      setModifier?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: 10947,
        }),
      ),
    )

    expect(result.value).toBe(0.5)
  })

  it('adds se set gear implications at 4pc and keeps spell scoping', () => {
    const threePieceSetGear: GearItem[] = Array.from(
      { length: 3 },
      (_, index) => ({
        id: index + 1,
        itemLevel: 1,
        setID: 1938,
      }),
    ) as GearItem[]
    const fourPieceSetGear: GearItem[] = Array.from(
      { length: 4 },
      (_, index) => ({
        id: index + 11,
        itemLevel: 1,
        setID: 1938,
      }),
    ) as GearItem[]

    const threePieceAuras =
      priestConfig.gearImplications?.(threePieceSetGear) ?? []
    const fourPieceAuras =
      priestConfig.gearImplications?.(fourPieceSetGear) ?? []

    expect(threePieceAuras).not.toContain(Buffs.SE_DPS_4pc)
    expect(fourPieceAuras).toContain(Buffs.SE_DPS_4pc)

    const setModifier = priestConfig.auraModifiers[Buffs.SE_DPS_4pc]
    const result = checkExists(
      setModifier?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: 116,
        }),
      ),
    )

    expect(result.value).toBe(0.5)
    expect(result.spellIds?.has(10947)).toBe(true)
    expect(result.spellIds?.has(116)).toBe(false)
  })
})
