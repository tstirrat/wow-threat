/**
 * Season of Discovery Rogue Threat Configuration Tests
 */
import { checkExists } from '@wow-threat/shared'
import { describe, expect, it } from 'vitest'

import {
  createCastContext,
  createDamageContext,
} from '../../test/helpers/context'
import { Spells, rogueConfig } from './rogue'

describe('sod rogue config', () => {
  it('adds tease taunt handler', () => {
    const formula = rogueConfig.abilities[Spells.Tease]
    const result = checkExists(
      formula?.(
        createCastContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.Tease,
        }),
      ),
    )

    expect(result.effects?.[0]?.type).toBe('customThreat')
  })

  it('adds aura modifiers and spell scoping for sod additions', () => {
    const justAFleshWoundModifier =
      rogueConfig.auraModifiers[Spells.JustAFleshWound]
    const mainGaucheModifier = rogueConfig.auraModifiers[Spells.MainGaucheBuff]
    const t1Tank2pcModifier = rogueConfig.auraModifiers[Spells.T1_Tank_2pc]

    const justAFleshWound = checkExists(
      justAFleshWoundModifier?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.SinisterStrikeR8,
        }),
      ),
    )
    const mainGauche = checkExists(
      mainGaucheModifier?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.SinisterStrikeR8,
        }),
      ),
    )
    const t1WithoutBladeDance = checkExists(
      t1Tank2pcModifier?.(
        createDamageContext(
          {
            timestamp: 1000,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 99,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: Spells.FanOfKnives,
          },
          new Set([Spells.T1_Tank_2pc, Spells.JustAFleshWound]),
        ),
      ),
    )
    const t1WithRequiredAuras = checkExists(
      t1Tank2pcModifier?.(
        createDamageContext(
          {
            timestamp: 1000,
            sourceID: 1,
            sourceIsFriendly: true,
            sourceInstance: 0,
            targetID: 99,
            targetIsFriendly: false,
            targetInstance: 0,
            abilityGameID: Spells.FanOfKnives,
          },
          new Set([
            Spells.T1_Tank_2pc,
            Spells.JustAFleshWound,
            Spells.BladeDance,
          ]),
        ),
      ),
    )

    expect(justAFleshWound.value).toBe(1.855)
    expect(mainGauche.value).toBe(1.51)
    expect(mainGauche.spellIds?.has(Spells.SinisterStrikeR8)).toBe(true)
    expect(mainGauche.spellIds?.has(Spells.UnfairAdvantage)).toBe(false)
    expect(t1WithoutBladeDance.value).toBe(1)
    expect(t1WithRequiredAuras.value).toBe(2)
  })

  it('adds unfair advantage threat modifier and taunt fixate', () => {
    const unfairAdvantageFormula = rogueConfig.abilities[Spells.UnfairAdvantage]
    const unfairAdvantageResult = checkExists(
      unfairAdvantageFormula?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.UnfairAdvantage,
        }),
      ),
    )

    expect(unfairAdvantageResult.value).toBe(150)
    expect(rogueConfig.fixateBuffs?.has(Spells.Tease)).toBe(true)

    const justAFleshWoundImplications = rogueConfig.auraImplications?.get(
      Spells.JustAFleshWound,
    )
    expect(justAFleshWoundImplications?.has(Spells.MainGauche)).toBe(true)
  })
})
