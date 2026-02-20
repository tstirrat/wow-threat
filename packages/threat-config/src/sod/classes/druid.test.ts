/**
 * Season of Discovery Druid Threat Configuration Tests
 */
import { SpellSchool, checkExists } from '@wow-threat/shared'
import { describe, expect, it } from 'vitest'

import { createDamageContext } from '../../test/helpers/context'
import { Spells, druidConfig } from './druid'

describe('sod druid config', () => {
  it('overrides swipe and adds lacerate threat handlers', () => {
    const swipeFormula = druidConfig.abilities[Spells.SwipeR5]
    const lacerateFormula = druidConfig.abilities[Spells.LacerateInitial]

    const swipeResult = checkExists(
      swipeFormula?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.SwipeR5,
        }),
      ),
    )
    const lacerateResult = checkExists(
      lacerateFormula?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.LacerateInitial,
        }),
      ),
    )

    expect(swipeResult.value).toBe(350)
    expect(lacerateResult.value).toBe(350)
  })

  it('adds moonkin school modifiers and t1 conditional bonus', () => {
    const moonkinModifier = druidConfig.auraModifiers[Spells.MoonkinForm]
    const t1Tank6pcModifier = druidConfig.auraModifiers[Spells.T1_Tank_6pc]
    const lacerateDotFormula = druidConfig.abilities[Spells.LacerateDot]

    const moonkinResult = checkExists(
      moonkinModifier?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.Starfall,
        }),
      ),
    )
    const t1OutsideBearForm = checkExists(
      t1Tank6pcModifier?.(
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
          new Set([Spells.T1_Tank_6pc]),
        ),
      ),
    )
    const t1InBearForm = checkExists(
      t1Tank6pcModifier?.(
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
          new Set([Spells.T1_Tank_6pc, Spells.BearForm]),
        ),
      ),
    )
    const lacerateDotResult = checkExists(
      lacerateDotFormula?.(
        createDamageContext({
          timestamp: 1000,
          sourceID: 1,
          sourceIsFriendly: true,
          sourceInstance: 0,
          targetID: 99,
          targetIsFriendly: false,
          targetInstance: 0,
          abilityGameID: Spells.LacerateDot,
        }),
      ),
    )

    expect(moonkinResult.value).toBe(0.7)
    expect(moonkinResult.schoolMask).toBe(
      SpellSchool.Nature | SpellSchool.Arcane,
    )
    expect(t1OutsideBearForm.value).toBe(1)
    expect(t1InBearForm.value).toBeCloseTo(1.1538461538)
    expect(lacerateDotResult.value).toBe(350)

    const moonkinImplications = druidConfig.auraImplications?.get(
      Spells.MoonkinForm,
    )
    expect(moonkinImplications?.has(Spells.Starsurge)).toBe(true)
    expect(moonkinImplications?.has(Spells.Starfall)).toBe(true)
  })
})
