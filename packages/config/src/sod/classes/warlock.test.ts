/**
 * Season of Discovery Warlock Threat Configuration Tests
 */
import { checkExists } from '@wow-threat/shared'
import { describe, expect, it } from 'vitest'

import { createDamageContext } from '../../test/helpers/context'
import { Spells, warlockConfig } from './warlock'

describe('sod warlock config', () => {
  it('adds metamorphosis aura modifier', () => {
    const metamorphosisModifier =
      warlockConfig.auraModifiers[Spells.Metamorphosis]
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
      warlockConfig.auraModifiers[Spells.MasterDemonologistR5]

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
          new Set([
            Spells.MasterDemonologistR5,
            Spells.Metamorphosis,
            Spells.ImpActive,
          ]),
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
          new Set([Spells.MasterDemonologistR5, Spells.ImpActive]),
        ),
      ),
    )

    expect(withMetamorphosis.value).toBe(1.2)
    expect(withoutMetamorphosis.value).toBe(0.8)
  })

  it('applies master demonologist rank scaling in both directions', () => {
    const cases: Array<[number, number]> = [
      [Spells.MasterDemonologistR1, 0.04],
      [Spells.MasterDemonologistR2, 0.08],
      [Spells.MasterDemonologistR3, 0.12],
      [Spells.MasterDemonologistR4, 0.16],
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
            new Set([buffId, Spells.Metamorphosis, Spells.ImpActive]),
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
            new Set([buffId, Spells.ImpActive]),
          ),
        ),
      )

      expect(withMetamorphosis.value).toBeCloseTo(1 + expected)
      expect(withoutMetamorphosis.value).toBeCloseTo(1 - expected)
    })
  })

  it('uses era master demonologist rank ids so rank 5 override matches live auras', () => {
    expect(Spells.MasterDemonologistR5).toBe(23829)
  })

  it('adds menace and demonic howl fixate and aura implications', () => {
    expect(warlockConfig.fixateBuffs?.has(Spells.Menace)).toBe(true)
    expect(warlockConfig.fixateBuffs?.has(Spells.DemonicHowl)).toBe(true)

    const metamorphosisImplications = warlockConfig.auraImplications?.get(
      Spells.Metamorphosis,
    )
    expect(metamorphosisImplications?.has(Spells.Menace)).toBe(true)
    expect(metamorphosisImplications?.has(Spells.DemonicHowl)).toBe(true)
  })
})
