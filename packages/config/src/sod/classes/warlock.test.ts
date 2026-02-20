/**
 * Season of Discovery Warlock Threat Configuration Tests
 */
import { checkExists } from '@wow-threat/shared'
import { describe, expect, it } from 'vitest'

import { createDamageContext } from '../../test/helpers/context'
import { Buffs, Spells, warlockConfig } from './warlock'

describe('sod warlock config', () => {
  it('adds metamorphosis aura modifier', () => {
    const metamorphosisModifier =
      warlockConfig.auraModifiers[Buffs.Metamorphosis]
    const result = checkExists(
      metamorphosisModifier?.(
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

    expect(result.value).toBe(1.77)
  })

  it('applies master demonologist based on metamorphosis state', () => {
    const masterDemonologistModifier =
      warlockConfig.auraModifiers[Buffs.MasterDemonologistR5]

    const withMetamorphosis = checkExists(
      masterDemonologistModifier?.(
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
          new Set([Buffs.MasterDemonologistR5, Buffs.Metamorphosis]),
        ),
      ),
    )
    const withoutMetamorphosis = checkExists(
      masterDemonologistModifier?.(
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
          new Set([Buffs.MasterDemonologistR5]),
        ),
      ),
    )

    expect(withMetamorphosis.value).toBe(0.2)
    expect(withoutMetamorphosis.value).toBe(-0.2)
  })

  it('applies master demonologist rank scaling in both directions', () => {
    const cases: Array<[number, number]> = [
      [Buffs.MasterDemonologistR1, 0.04],
      [Buffs.MasterDemonologistR2, 0.08],
      [Buffs.MasterDemonologistR3, 0.12],
      [Buffs.MasterDemonologistR4, 0.16],
    ]

    cases.forEach(([buffId, expected]) => {
      const modifier = warlockConfig.auraModifiers[buffId]
      const withMetamorphosis = checkExists(
        modifier?.(
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
            new Set([buffId, Buffs.Metamorphosis]),
          ),
        ),
      )
      const withoutMetamorphosis = checkExists(
        modifier?.(
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
            new Set([buffId]),
          ),
        ),
      )

      expect(withMetamorphosis.value).toBeCloseTo(expected)
      expect(withoutMetamorphosis.value).toBeCloseTo(-expected)
    })
  })

  it('adds menace and demonic howl fixate and aura implications', () => {
    expect(warlockConfig.fixateBuffs?.has(Spells.Menace)).toBe(true)
    expect(warlockConfig.fixateBuffs?.has(Spells.DemonicHowl)).toBe(true)

    const metamorphosisImplications = warlockConfig.auraImplications?.get(
      Buffs.Metamorphosis,
    )
    expect(metamorphosisImplications?.has(Spells.Menace)).toBe(true)
    expect(metamorphosisImplications?.has(Spells.DemonicHowl)).toBe(true)
  })
})
