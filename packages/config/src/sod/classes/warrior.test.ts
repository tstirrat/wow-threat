/**
 * Season of Discovery Warrior Threat Configuration Tests
 */
import { checkExists } from '@wow-threat/shared'
import type { GearItem } from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import {
  createCastContext,
  createDamageContext,
} from '../../test/helpers/context'
import { Spells, warriorConfig } from './warrior'

describe('sod warrior config', () => {
  it('disables warrior stance aura implications in sod', () => {
    expect(warriorConfig.auraImplications).toBeUndefined()
  })

  it('applies gladiator stance threat multiplier and SE override', () => {
    const gladiatorModifier =
      warriorConfig.auraModifiers[Spells.GladiatorStance]
    expect(gladiatorModifier).toBeDefined()

    const normal = checkExists(
      gladiatorModifier?.(
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
          new Set([Spells.GladiatorStance]),
        ),
      ),
    )
    const withSeSet = checkExists(
      gladiatorModifier?.(
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
          new Set([Spells.GladiatorStance, Spells.SE_Tank_6pc]),
        ),
      ),
    )

    expect(normal.value).toBe(0.7)
    expect(withSeSet.value).toBe(1.3)
  })

  it('marks gladiator stance cast as no threat', () => {
    const formula = warriorConfig.abilities[Spells.GladiatorStance]
    const result = formula?.(
      createCastContext({
        timestamp: 1000,
        sourceID: 1,
        sourceIsFriendly: true,
        sourceInstance: 0,
        targetID: 99,
        targetIsFriendly: false,
        targetInstance: 0,
        abilityGameID: Spells.GladiatorStance,
      }),
    )

    expect(result).toBeUndefined()
  })

  it('overrides shield slam rank formulas for sod', () => {
    const formula = warriorConfig.abilities[Spells.ShieldSlamR4]
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
          abilityGameID: Spells.ShieldSlamR4,
        }),
      ),
    )

    expect(result.formula).toBe('(amt * 2) + 254')
    expect(result.value).toBe(454)
  })

  it('adds rune and set gear implications with spell scoping', () => {
    const sixPieceT1: GearItem[] = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      itemLevel: 1,
      setID: 1719,
    })) as GearItem[]
    const fourPieceTaq: GearItem[] = Array.from({ length: 4 }, (_, index) => ({
      id: index + 20,
      itemLevel: 1,
      setID: 1857,
    })) as GearItem[]
    const sixPieceSe: GearItem[] = Array.from({ length: 6 }, (_, index) => ({
      id: index + 40,
      itemLevel: 1,
      setID: 1933,
    })) as GearItem[]

    const t1Auras = warriorConfig.gearImplications?.(sixPieceT1) ?? []
    const taqAuras = warriorConfig.gearImplications?.(fourPieceTaq) ?? []
    const seAuras = warriorConfig.gearImplications?.(sixPieceSe) ?? []
    const runeAuras =
      warriorConfig.gearImplications?.([
        { id: 80, itemLevel: 1, temporaryEnchant: 6800 } as GearItem,
        { id: 81, itemLevel: 1, temporaryEnchant: 6801 } as GearItem,
      ]) ?? []

    expect(t1Auras).toContain(Spells.T1_Tank_6pc)
    expect(taqAuras).toContain(Spells.TAQ_Tank_4pc)
    expect(seAuras).toContain(Spells.SE_Tank_6pc)
    expect(runeAuras).toContain(Spells.RuneOfDevastate)
    expect(runeAuras).toContain(Spells.RuneOfFuriousThunder)

    const taqModifier = checkExists(
      warriorConfig.auraModifiers[Spells.TAQ_Tank_4pc]?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.ShieldSlamR1,
        }),
      ),
    )
    const devastateRuneWithoutStance = checkExists(
      warriorConfig.auraModifiers[Spells.RuneOfDevastate]?.(
        createDamageContext(
          {
            timestamp: 1000,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 99,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: Spells.Devastate,
          },
          new Set([Spells.RuneOfDevastate]),
        ),
      ),
    )
    const devastateRuneWithDefensiveStance = checkExists(
      warriorConfig.auraModifiers[Spells.RuneOfDevastate]?.(
        createDamageContext(
          {
            timestamp: 1000,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 99,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: Spells.Devastate,
          },
          new Set([Spells.RuneOfDevastate, Spells.DefensiveStance]),
        ),
      ),
    )
    const furiousThunderRune = checkExists(
      warriorConfig.auraModifiers[Spells.RuneOfFuriousThunder]?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.ThunderClapR6,
        }),
      ),
    )

    expect(taqModifier.value).toBe(1.5)
    expect(taqModifier.spellIds?.has(Spells.ShieldSlamR2)).toBe(true)
    expect(taqModifier.spellIds?.has(Spells.Devastate)).toBe(false)
    expect(devastateRuneWithoutStance.value).toBe(1)
    expect(devastateRuneWithDefensiveStance.value).toBe(1.5)
    expect(
      devastateRuneWithDefensiveStance.spellIds?.has(Spells.Devastate),
    ).toBe(true)
    expect(
      devastateRuneWithDefensiveStance.spellIds?.has(Spells.ThunderClapR1),
    ).toBe(false)
    expect(furiousThunderRune.value).toBe(1.5)
    expect(furiousThunderRune.spellIds?.has(Spells.ThunderClapR3)).toBe(true)
    expect(furiousThunderRune.spellIds?.has(Spells.Devastate)).toBe(false)
  })
})
