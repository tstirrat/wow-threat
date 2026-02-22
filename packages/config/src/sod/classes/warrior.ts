/**
 * Warrior Threat Configuration - Season of Discovery
 */
import type { ClassThreatConfig } from '@wow-threat/shared'
import type { GearItem } from '@wow-threat/wcl-types'

import {
  Spells as EraSpells,
  warriorConfig as eraWarriorConfig,
} from '../../era/classes/warrior'
import { noThreat, threat } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  ShieldSlamR1: 23922, // https://www.wowhead.com/classic/spell=23922/
  ShieldSlamR2: 23923, // https://www.wowhead.com/classic/spell=23923/
  ShieldSlamR3: 23924, // https://www.wowhead.com/classic/spell=23924/
  ShieldSlamR4: 23925, // https://www.wowhead.com/classic/spell=23925/
  Devastate: 20243, // https://www.wowhead.com/classic/spell=20243/
  DevastateSoD: 403196, // https://www.wowhead.com/classic/spell=403196/
  ThunderClapR1: 6343, // https://www.wowhead.com/classic/spell=6343/
  ThunderClapR2: 8198, // https://www.wowhead.com/classic/spell=8198/
  ThunderClapR3: 8204, // https://www.wowhead.com/classic/spell=8204/
  ThunderClapR4: 8205, // https://www.wowhead.com/classic/spell=8205/
  ThunderClapR5: 11580, // https://www.wowhead.com/classic/spell=11580/
  ThunderClapR6: 11581, // https://www.wowhead.com/classic/spell=11581/
  GladiatorStance: 412513, // https://www.wowhead.com/classic/spell=412513/
  T1_Tank_6pc: 457651, // https://www.wowhead.com/classic/spell=457651/
  TAQ_Tank_4pc: 1214162, // https://www.wowhead.com/classic/spell=1214162/
  SE_Tank_6pc: 1227245, // https://www.wowhead.com/classic/spell=1227245/
  RuneOfDevastate: 403195, // https://www.wowhead.com/classic/spell=403195/
  RuneOfFuriousThunder: 403219, // https://www.wowhead.com/classic/spell=403219/
} as const

const SetIds = {
  T1_Tank: 1719,
  TAQ_Tank: 1857,
  SETank: 1933,
} as const

const Enchants = {
  SoulOfEnmity: 7678,
  SoulOfTheSentinel: 7683,
} as const

const Runes = {
  Devastate: 6800,
  FuriousThunder: 6801,
} as const

const Mods = {
  GladiatorStance: 0.7,
  SE_Tank_6pcGladiatorStance: 1.3,
  T1_Tank_6pc: 1.1,
  TAQ_Tank_4pcShieldSlam: 1.5,
  RuneOfDevastate: 1.5,
  RuneOfFuriousThunder: 1.5,
  ShieldSlam: 2,
} as const

const SHIELD_SLAM_SPELL_IDS = new Set<number>([
  Spells.ShieldSlamR1,
  Spells.ShieldSlamR2,
  Spells.ShieldSlamR3,
  Spells.ShieldSlamR4,
])

const DEVASTATE_SPELL_IDS = new Set<number>([
  Spells.Devastate,
  Spells.DevastateSoD,
])

const THUNDER_CLAP_SPELL_IDS = new Set<number>([
  Spells.ThunderClapR1,
  Spells.ThunderClapR2,
  Spells.ThunderClapR3,
  Spells.ThunderClapR4,
  Spells.ThunderClapR5,
  Spells.ThunderClapR6,
  EraSpells.Thunderclap,
])

function inferGearAuras(gear: GearItem[]): number[] {
  const inheritedAuras = eraWarriorConfig.gearImplications?.(gear) ?? []
  const t1_TankPieces = gear.filter(
    (item) => item.setID === SetIds.T1_Tank,
  ).length
  const taq_TankPieces = gear.filter(
    (item) => item.setID === SetIds.TAQ_Tank,
  ).length
  const seTankPieces = gear.filter(
    (item) => item.setID === SetIds.SETank,
  ).length
  const inferredAuras = new Set<number>(inheritedAuras)

  if (
    t1_TankPieces >= 6 ||
    gear.some((item) => item.temporaryEnchant === Enchants.SoulOfEnmity)
  ) {
    inferredAuras.add(Spells.T1_Tank_6pc)
  }

  if (
    taq_TankPieces >= 4 ||
    gear.some((item) => item.temporaryEnchant === Enchants.SoulOfTheSentinel)
  ) {
    inferredAuras.add(Spells.TAQ_Tank_4pc)
  }

  if (seTankPieces >= 6) {
    inferredAuras.add(Spells.SE_Tank_6pc)
  }

  if (gear.some((item) => item.temporaryEnchant === Runes.Devastate)) {
    inferredAuras.add(Spells.RuneOfDevastate)
  }

  if (gear.some((item) => item.temporaryEnchant === Runes.FuriousThunder)) {
    inferredAuras.add(Spells.RuneOfFuriousThunder)
  }

  return [...inferredAuras]
}

export const warriorConfig: ClassThreatConfig = {
  ...eraWarriorConfig,

  // SoD allows broader cross-stance usage, so cast-based stance inference is noisy.
  auraImplications: undefined,

  auraModifiers: {
    ...eraWarriorConfig.auraModifiers,
    [Spells.GladiatorStance]: (ctx) => ({
      source: 'stance',
      name: 'Gladiator Stance',
      value: ctx.sourceAuras.has(Spells.SE_Tank_6pc)
        ? Mods.SE_Tank_6pcGladiatorStance
        : Mods.GladiatorStance,
    }),
    [Spells.T1_Tank_6pc]: (ctx) => ({
      source: 'gear',
      name: 'S03 - T1 - Warrior - Tank 6pc',
      value: ctx.sourceAuras.has(EraSpells.DefensiveStance)
        ? Mods.T1_Tank_6pc
        : 1,
    }),
    [Spells.TAQ_Tank_4pc]: () => ({
      source: 'gear',
      name: 'S03 - TAQ - Warrior - Tank 4pc',
      spellIds: SHIELD_SLAM_SPELL_IDS,
      value: Mods.TAQ_Tank_4pcShieldSlam,
    }),
    [Spells.RuneOfDevastate]: (ctx) => ({
      source: 'gear',
      name: 'Rune of Devastate',
      spellIds: DEVASTATE_SPELL_IDS,
      value: ctx.sourceAuras.has(EraSpells.DefensiveStance)
        ? Mods.RuneOfDevastate
        : 1,
    }),
    [Spells.RuneOfFuriousThunder]: () => ({
      source: 'gear',
      name: 'Rune of Furious Thunder',
      spellIds: THUNDER_CLAP_SPELL_IDS,
      value: Mods.RuneOfFuriousThunder,
    }),
  },

  abilities: {
    ...eraWarriorConfig.abilities,
    [Spells.GladiatorStance]: noThreat(),
    [Spells.ShieldSlamR1]: threat({
      modifier: Mods.ShieldSlam,
      bonus: 178,
    }),
    [Spells.ShieldSlamR2]: threat({
      modifier: Mods.ShieldSlam,
      bonus: 203,
    }),
    [Spells.ShieldSlamR3]: threat({
      modifier: Mods.ShieldSlam,
      bonus: 229,
    }),
    [Spells.ShieldSlamR4]: threat({
      modifier: Mods.ShieldSlam,
      bonus: 254,
    }),
  },

  gearImplications: inferGearAuras,
}
