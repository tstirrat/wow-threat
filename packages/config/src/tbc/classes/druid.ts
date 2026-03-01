/**
 * Anniversary druid deltas over Era.
 *
 * Ports TBC-specific druid mechanics and only overrides spells/talents that
 * differ from Era defaults.
 */
import type { ClassThreatConfig, SpellId } from '@wow-threat/shared'
import type { GearItem } from '@wow-threat/wcl-types'

import {
  Spells as EraSpells,
  druidConfig as eraDruidConfig,
} from '../../era/classes/druid'
import {
  noThreat,
  threat,
  threatOnCastRollbackOnMiss,
  threatOnDebuff,
  threatOnSuccessfulHit,
} from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  MaulR8: 26996, // https://www.wowhead.com/tbc/spell=26996/
  SwipeR6: 26997, // https://www.wowhead.com/tbc/spell=26997/
  DemoRoarR6: 26998, // https://www.wowhead.com/tbc/spell=26998/
  FaerieFireFeralR5: 27011, // https://www.wowhead.com/tbc/spell=27011/
  FaerieFireR5: 26993, // https://www.wowhead.com/tbc/spell=26993/
  CowerR4: 31709, // https://www.wowhead.com/tbc/spell=31709/
  CowerR5: 27004, // https://www.wowhead.com/tbc/spell=27004/
  Lacerate: 33745, // https://www.wowhead.com/tbc/spell=33745/
  MangleBearR1: 33878, // https://www.wowhead.com/tbc/spell=33878/
  MangleBearR2: 33986, // https://www.wowhead.com/tbc/spell=33986/
  MangleBearR3: 33987, // https://www.wowhead.com/tbc/spell=33987/
  PrimalFury: 16959, // https://www.wowhead.com/tbc/spell=16959/
  ImprovedLeaderOfThePack: 34299, // https://www.wowhead.com/tbc/spell=34299/
  T6_2pcBuff: 38447, // https://www.wowhead.com/tbc/spell=38447/
} as const

const SetIds = {
  T6: 676,
} as const

const Mods = {
  Mangle:
    1 +
    (1.5 - 1.15) /
      1.15 /* keeps post-2.1 mangle threat equivalent to pre-2.1 */,
  T6_2pcMangle: 1.5,
} as const

const HEALING_SPELLS_TBC = new Set([
  // Healing Touch
  5185, 5186, 5187, 5188, 5189, 6778, 8903, 9758, 9888, 9889, 25297, 26978,
  26979,
  // Regrowth
  8936, 8938, 8940, 8941, 9750, 9856, 9857, 9858, 26980,
  // Rejuvenation
  774, 1058, 1430, 2090, 2091, 3627, 8910, 9839, 9840, 9841, 25299, 26981,
  26982,
  // Tranquility
  740, 8918, 9862, 9863, 26983,
])

function hasBearForm(sourceAuras: ReadonlySet<SpellId>): boolean {
  return (
    sourceAuras.has(Spells.BearForm) || sourceAuras.has(Spells.DireBearForm)
  )
}

function inferGearAuras(gear: GearItem[]): number[] {
  const inheritedAuras = eraDruidConfig.gearImplications?.(gear) ?? []
  const inferredAuras = new Set<number>(inheritedAuras)
  const t6Pieces = gear.filter((item) => item.setID === SetIds.T6).length

  if (t6Pieces >= 2) {
    inferredAuras.add(Spells.T6_2pcBuff)
  }

  return [...inferredAuras]
}

const maulRank1Bonus = (322 / 67) * 10
const maulRank2Bonus = (322 / 67) * 18
const maulRank3Bonus = (322 / 67) * 26
const maulRank4Bonus = (322 / 67) * 34
const maulRank5Bonus = (322 / 67) * 42
const maulRank6Bonus = (322 / 67) * 50
const maulRank7Bonus = (322 / 67) * 58

const lacerateFormula = (
  ctx: Parameters<ClassThreatConfig['abilities'][number]>[0],
) => {
  if (ctx.event.type !== 'damage') {
    return undefined
  }

  if (ctx.event.tick) {
    return {
      value: ctx.amount * 0.5,
      splitAmongEnemies: false,
      spellModifier: {
        type: 'spell' as const,
        value: 0.5,
        bonus: 0,
      },
    }
  }

  return threatOnSuccessfulHit({ bonus: 267 })(ctx)
}

const noThreatFormula = noThreat()

export const druidConfig: ClassThreatConfig = {
  ...eraDruidConfig,
  // TBC intentionally avoids Era's synthetic druid stance implications.
  auraImplications: new Map(),

  auraModifiers: {
    ...eraDruidConfig.auraModifiers,

    [Spells.FeralInstinctRank1]: (ctx) => ({
      source: 'talent',
      name: 'Feral Instinct (Rank 1)',
      value: hasBearForm(ctx.sourceAuras) ? (1.3 + 0.05 * 1) / 1.3 : 1,
    }),
    [Spells.FeralInstinctRank2]: (ctx) => ({
      source: 'talent',
      name: 'Feral Instinct (Rank 2)',
      value: hasBearForm(ctx.sourceAuras) ? (1.3 + 0.05 * 2) / 1.3 : 1,
    }),
    [Spells.FeralInstinctRank3]: (ctx) => ({
      source: 'talent',
      name: 'Feral Instinct (Rank 3)',
      value: hasBearForm(ctx.sourceAuras) ? (1.3 + 0.05 * 3) / 1.3 : 1,
    }),

    [Spells.SubtletyRank1]: () => ({
      source: 'talent',
      name: 'Subtlety (Rank 1)',
      spellIds: HEALING_SPELLS_TBC,
      value: 0.96,
    }),
    [Spells.SubtletyRank2]: () => ({
      source: 'talent',
      name: 'Subtlety (Rank 2)',
      spellIds: HEALING_SPELLS_TBC,
      value: 0.92,
    }),
    [Spells.SubtletyRank3]: () => ({
      source: 'talent',
      name: 'Subtlety (Rank 3)',
      spellIds: HEALING_SPELLS_TBC,
      value: 0.88,
    }),
    [Spells.SubtletyRank4]: () => ({
      source: 'talent',
      name: 'Subtlety (Rank 4)',
      spellIds: HEALING_SPELLS_TBC,
      value: 0.84,
    }),
    [Spells.SubtletyRank5]: () => ({
      source: 'talent',
      name: 'Subtlety (Rank 5)',
      spellIds: HEALING_SPELLS_TBC,
      value: 0.8,
    }),

    [Spells.T6_2pcBuff]: () => ({
      source: 'gear',
      name: 'Improved Mangle (T6 2pc)',
      spellIds: new Set([
        Spells.MangleBearR1,
        Spells.MangleBearR2,
        Spells.MangleBearR3,
      ]),
      value: Mods.T6_2pcMangle / Mods.Mangle,
    }),
  },

  abilities: {
    ...eraDruidConfig.abilities,
    [Spells.MaulR1]: threatOnSuccessfulHit({ bonus: maulRank1Bonus }),
    [Spells.MaulR2]: threatOnSuccessfulHit({ bonus: maulRank2Bonus }),
    [Spells.MaulR3]: threatOnSuccessfulHit({ bonus: maulRank3Bonus }),
    [Spells.MaulR4]: threatOnSuccessfulHit({ bonus: maulRank4Bonus }),
    [Spells.MaulR5]: threatOnSuccessfulHit({ bonus: maulRank5Bonus }),
    [Spells.MaulR6]: threatOnSuccessfulHit({ bonus: maulRank6Bonus }),
    [Spells.MaulR7]: threatOnSuccessfulHit({ bonus: maulRank7Bonus }),
    [Spells.MaulR8]: threatOnSuccessfulHit({ bonus: 322 }),

    [Spells.SwipeR1]: threat({ modifier: 1 }),
    [Spells.SwipeR2]: threat({ modifier: 1 }),
    [Spells.SwipeR3]: threat({ modifier: 1 }),
    [Spells.SwipeR4]: threat({ modifier: 1 }),
    [Spells.SwipeR5]: threat({ modifier: 1 }),
    [Spells.SwipeR6]: threat({ modifier: 1 }),

    [Spells.DemoRoarR5]: threatOnDebuff(39),
    [Spells.DemoRoarR6]: threatOnDebuff(39),

    [Spells.Lacerate]: lacerateFormula,
    [Spells.MangleBearR1]: threat({ modifier: Mods.Mangle }),
    [Spells.MangleBearR2]: threat({ modifier: Mods.Mangle }),
    [Spells.MangleBearR3]: threat({ modifier: Mods.Mangle }),

    [Spells.CowerR4]: threatOnCastRollbackOnMiss(-800),
    [Spells.CowerR5]: threatOnCastRollbackOnMiss(-1170),

    [Spells.FaerieFireFeralR4]: threatOnDebuff(108),
    [Spells.FaerieFireFeralR5]: threatOnDebuff(131),
    [Spells.FaerieFireR4]: threatOnDebuff(108),
    [Spells.FaerieFireR5]: threatOnDebuff(131),

    [Spells.PrimalFury]: noThreatFormula,
    [Spells.Furor]: noThreatFormula,
    [Spells.ImprovedLeaderOfThePack]: noThreatFormula,
  },

  gearImplications: inferGearAuras,
}
