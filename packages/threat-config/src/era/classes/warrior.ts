/**
 * Warrior Threat Configuration - Anniversary Edition
 *
 * Spell IDs and threat values are based on Classic/Anniversary Edition mechanics.
 */
import type {
  ClassThreatConfig,
  SpellId,
  TalentImplicationContext,
} from '@wcl-threat/shared'
import type { GearItem } from '@wcl-threat/wcl-types'

import {
  calculateThreat,
  calculateThreatOnSuccessfulHit,
  noThreat as noThreatFormula,
  tauntTarget,
  threatOnBuff,
  threatOnCastRollbackOnMiss,
  threatOnDebuff,
} from '../../shared/formulas'
import { clampRank, inferMappedTalentRank } from '../../shared/talents'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  // Heroic Strike
  HeroicStrikeR1: 78,
  HeroicStrikeR2: 284,
  HeroicStrikeR3: 285,
  HeroicStrikeR4: 1608,
  HeroicStrikeR5: 11564,
  HeroicStrikeR6: 11565,
  HeroicStrikeR7: 11566,
  HeroicStrikeR8: 11567,
  HeroicStrikeR9: 25286,

  // Shield Slam
  ShieldSlamR1: 23922,
  ShieldSlamR2: 23923,
  ShieldSlamR3: 23924,
  ShieldSlamR4: 23925,

  // Shield Bash
  ShieldBashR1: 72,
  ShieldBashR2: 1671,
  ShieldBashR3: 1672,

  // Revenge
  RevengeR1: 6572,
  RevengeR2: 6574,
  RevengeR3: 7379,
  RevengeR4: 11600,
  RevengeR5: 11601,
  RevengeR6: 25288,
  RevengeStun: 12798,

  // Cleave
  CleaveR1: 845,
  CleaveR2: 7369,
  CleaveR3: 11608,
  CleaveR4: 11609,
  CleaveR5: 20569,
  CleaveR6: 25231,

  // Whirlwind / Execute
  WhirlwindR1: 1680,
  MortalStrike: 25248,
  ExecuteR6: 20647,
  ExecuteR7: 25236,

  // Thunder Clap
  ThunderClapR1: 6343,
  ThunderClapR2: 8198,
  ThunderClapR3: 8204,
  ThunderClapR4: 8205,
  ThunderClapR5: 11580,
  ThunderClapR6: 11581,
  ThunderClapR7: 23931,

  // Hamstring
  HamstringR1: 1715,
  HamstringR2: 7372,
  HamstringR3: 7373,
  HamstringR4: 25212,

  // Intercept
  InterceptR1: 20252,
  InterceptStunR1: 20253,
  InterceptR2: 20616,
  InterceptStunR2: 20614,
  InterceptR3: 20617,
  InterceptStunR3: 20615,

  // Sunder Armor
  SunderArmorR1: 7386, // https://wowhead.com/classic/spell=7386/
  SunderArmorR2: 7405, // https://wowhead.com/classic/spell=7405/
  SunderArmorR3: 8380, // https://wowhead.com/classic/spell=8380/
  SunderArmorR4: 11596, // https://wowhead.com/classic/spell=11596/
  SunderArmorR5: 11597, // https://wowhead.com/classic/spell=11597/

  // Battle / Demo Shout
  BattleShoutR1: 6673,
  BattleShoutR2: 5242,
  BattleShoutR3: 6192,
  BattleShoutR4: 11549,
  BattleShoutR5: 11550,
  BattleShoutR6: 11551,
  BattleShoutR7: 25289,
  DemoShoutR5: 11556,
  DemoShoutR7: 25203,

  // Mocking Blow
  MockingBlowR1: 694,
  MockingBlowR2: 7400,
  MockingBlowR3: 7402,
  MockingBlowR4: 20559,
  MockingBlowR5: 20560,

  // Core utility
  Taunt: 355,
  ChallengingShout: 1161,
  Disarm: 676,

  // Overpower / Charge / stance implications
  OverpowerR1: 7384,
  OverpowerR2: 7887,
  OverpowerR3: 11584,
  OverpowerR4: 11585,
  ChargeR1: 100,
  ChargeR2: 6178,
  ChargeR3: 11578,
  ChargeStun: 7922,
  Retaliation: 20230,
  SweepingStrikes: 12292,

  // Misc utility and talents/procs
  BerserkerRage: 18499,
  Recklessness: 1719,
  ShieldWall: 871,
  ShieldBlock: 2565,
  DeathWish: 12328,
  PiercingHowl: 12323,
  Enrage: 14204,
  LastStandCast: 12975,
  LastStandBuff: 12976,
  FlurryR1: 12966,
  FlurryR2: 12967,
  FlurryR3: 12968,
  FlurryR4: 12969,
  FlurryR5: 12970,
  BattlegearOfMightProc: 29478,
  ShieldSpecialization: 23602,

  // Resource gain abilities
  BloodrageCast: 2687,
  BloodrageRageGain: 29131,
  UnbridledWrath: 12964,

  // Direct damage / heal abilities
  RendR6: 11574,
  DeepWounds: 12721,
  PummelR1: 6552,
  PummelR2: 6554,
  BloodthirstR1: 23881,
  BloodthirstR2: 23892,
  BloodthirstR3: 23893,
  BloodthirstR4: 23894,
  BloodthirstBuffR1: 23888,
  BloodthirstBuffR2: 23885,
  BloodthirstHeal: 23891,

  // Stances
  DefensiveStance: 71,
  BattleStance: 2457,
  BerserkerStance: 2458,

  // Buffs/Set Bonuses
  T1_8pc: 23561, // Might 8pc - Sunder Armor threat +15%
  T25_4pc: 23302, // AQ40 Conqueror 4pc

  // Talents (detected via auras)
  Defiance: 12303, // Legacy Defiance spell ID alias
  DefianceRank1: 12301,
  DefianceRank2: 12302,
  DefianceRank3: 12303,
  DefianceRank4: 12304,
  DefianceRank5: 12305,

  // Legacy aliases kept for compatibility/readability in tests
  HeroicStrike: 25286,
  Cleave: 25231,
  Execute: 25236,
  Whirlwind: 25248,
  Thunderclap: 23931,
  Hamstring: 25212,
  BattleShout: 25289,
  DemoShout: 25203,
  MockingBlow: 20560,
  ShieldBash: 1672,
  Overpower: 11585,
  Bloodthirst: 23894,
} as const

// ============================================================================
// Set IDs for gear detection
// ============================================================================

export const SetIds = {
  T1: 209, // Battlegear of Might (Warrior Tier 1)
} as const

const DEFIANCE_AURA_BY_RANK = [
  Spells.DefianceRank1,
  Spells.DefianceRank2,
  Spells.DefianceRank3,
  Spells.DefianceRank4,
  Spells.DefianceRank5,
] as const

const DEFIANCE_RANK_BY_TALENT_ID = new Map<number, number>(
  DEFIANCE_AURA_BY_RANK.map((spellId, idx) => [spellId, idx + 1]),
)

const PROTECTION_TREE_INDEX = 2
const DEFIANCE_PROTECTION_POINTS_THRESHOLD = 14

function inferDefianceRank(ctx: TalentImplicationContext): number {
  const fromRankSpellIds = inferMappedTalentRank(
    ctx.talentRanks,
    DEFIANCE_RANK_BY_TALENT_ID,
    DEFIANCE_AURA_BY_RANK.length,
  )
  const fromDefianceAlias = clampRank(
    ctx.talentRanks.get(Spells.Defiance) ?? 0,
    DEFIANCE_AURA_BY_RANK.length,
  )
  const rankedDefiance = Math.max(fromRankSpellIds, fromDefianceAlias)
  if (rankedDefiance > 0) {
    return rankedDefiance
  }

  const protectionPoints = Math.trunc(
    ctx.talentPoints[PROTECTION_TREE_INDEX] ?? 0,
  )
  if (protectionPoints < DEFIANCE_PROTECTION_POINTS_THRESHOLD) {
    return 0
  }

  // Legacy payloads can lack per-talent ranks and only expose tree splits.
  // With at least 14 points in Protection, infer Defiance as a tanking build heuristic.
  return DEFIANCE_AURA_BY_RANK.length
}

function inferGearAuras(gear: GearItem[]): number[] {
  const t1Pieces = gear.filter((item) => item.setID === SetIds.T1).length
  return t1Pieces >= 8 ? [Spells.T1_8pc] : []
}

const noThreat = noThreatFormula()

const threatOnHit = (bonus: number): ReturnType<typeof calculateThreat> =>
  calculateThreatOnSuccessfulHit({
    modifier: 1,
    bonus,
  })

const modDamagePlusThreat = (
  modifier: number,
  bonus: number,
): ReturnType<typeof calculateThreat> =>
  calculateThreatOnSuccessfulHit({
    modifier,
    bonus,
  })

const modDamage = (modifier: number): ReturnType<typeof calculateThreat> =>
  calculateThreat({
    modifier,
    eventTypes: ['damage'],
  })

const resourceChangeThreat = (
  applyPlayerMultipliers: boolean,
): ReturnType<typeof calculateThreat> =>
  calculateThreat({
    modifier: 5,
    split: true,
    eventTypes: ['resourcechange'],
    applyPlayerMultipliers,
  })

const BATTLE_STANCE_IMPLIED_ABILITIES: ReadonlySet<SpellId> = new Set([
  Spells.OverpowerR1,
  Spells.OverpowerR2,
  Spells.OverpowerR3,
  Spells.OverpowerR4,
  Spells.ChargeR1,
  Spells.ChargeR2,
  Spells.ChargeR3,
  Spells.ThunderClapR1,
  Spells.ThunderClapR2,
  Spells.ThunderClapR3,
  Spells.ThunderClapR4,
  Spells.ThunderClapR5,
  Spells.ThunderClapR6,
  Spells.ThunderClapR7,
  Spells.MockingBlowR1,
  Spells.MockingBlowR2,
  Spells.MockingBlowR3,
  Spells.MockingBlowR4,
  Spells.MockingBlowR5,
  Spells.Retaliation,
  Spells.SweepingStrikes,
])

const BERSERKER_STANCE_IMPLIED_ABILITIES: ReadonlySet<SpellId> = new Set([
  Spells.InterceptR1,
  Spells.InterceptR2,
  Spells.InterceptR3,
  Spells.WhirlwindR1,
  Spells.MortalStrike,
  Spells.BerserkerRage,
  Spells.Recklessness,
  Spells.PummelR1,
  Spells.PummelR2,
])

const DEFENSIVE_STANCE_IMPLIED_ABILITIES: ReadonlySet<SpellId> = new Set([
  Spells.Taunt,
  Spells.Disarm,
  Spells.RevengeR1,
  Spells.RevengeR2,
  Spells.RevengeR3,
  Spells.RevengeR4,
  Spells.RevengeR5,
  Spells.RevengeR6,
  Spells.ShieldBlock,
  Spells.ShieldWall,
])

// ============================================================================
// Configuration
// ============================================================================

/** Exclusive aura sets - engine auto-removes others when one is applied */
export const exclusiveAuras: Set<number>[] = [
  new Set([
    Spells.DefensiveStance,
    Spells.BerserkerStance,
    Spells.BattleStance,
  ]),
]

export const warriorConfig: ClassThreatConfig = {
  exclusiveAuras,

  auraImplications: new Map([
    [Spells.BattleStance, BATTLE_STANCE_IMPLIED_ABILITIES],
    [Spells.BerserkerStance, BERSERKER_STANCE_IMPLIED_ABILITIES],
    [Spells.DefensiveStance, DEFENSIVE_STANCE_IMPLIED_ABILITIES],
  ]),

  auraModifiers: {
    [Spells.DefensiveStance]: () => ({
      source: 'stance',
      name: 'Defensive Stance',
      value: 1.3,
    }),

    [Spells.BerserkerStance]: () => ({
      source: 'stance',
      name: 'Berserker Stance',
      value: 0.8,
    }),

    [Spells.DefianceRank1]: () => ({
      source: 'talent',
      name: 'Defiance (Rank 1)',
      value: 1.03,
    }),
    [Spells.DefianceRank2]: () => ({
      source: 'talent',
      name: 'Defiance (Rank 2)',
      value: 1.06,
    }),
    [Spells.DefianceRank3]: () => ({
      source: 'talent',
      name: 'Defiance (Rank 3)',
      value: 1.09,
    }),
    [Spells.DefianceRank4]: () => ({
      source: 'talent',
      name: 'Defiance (Rank 4)',
      value: 1.12,
    }),
    [Spells.DefianceRank5]: () => ({
      source: 'talent',
      name: 'Defiance (Rank 5)',
      value: 1.15,
    }),

    [Spells.T1_8pc]: () => ({
      source: 'gear',
      name: 'Might 8pc',
      spellIds: new Set([
        Spells.SunderArmorR1,
        Spells.SunderArmorR2,
        Spells.SunderArmorR3,
        Spells.SunderArmorR4,
        Spells.SunderArmorR5,
      ]),
      value: 1.15,
    }),
    [Spells.T25_4pc]: () => ({
      source: 'gear',
      name: 'Conqueror 4pc',
      value: 1.1,
    }),
  },

  abilities: {
    // Stances and zero-threat utility abilities
    [Spells.DefensiveStance]: noThreat,
    [Spells.BattleStance]: noThreat,
    [Spells.BerserkerStance]: noThreat,
    [Spells.RevengeStun]: noThreat,
    [Spells.BattlegearOfMightProc]: noThreat,
    [Spells.ShieldSpecialization]: noThreat,
    [Spells.ChargeR3]: noThreat,
    [Spells.ChargeStun]: noThreat,
    [Spells.BerserkerRage]: noThreat,
    [Spells.FlurryR1]: noThreat,
    [Spells.FlurryR2]: noThreat,
    [Spells.FlurryR3]: noThreat,
    [Spells.FlurryR4]: noThreat,
    [Spells.FlurryR5]: noThreat,
    [Spells.DeathWish]: noThreat,
    [Spells.ShieldWall]: noThreat,
    [Spells.Recklessness]: noThreat,
    [Spells.PiercingHowl]: noThreat,
    [Spells.Enrage]: noThreat,
    [Spells.LastStandCast]: noThreat,
    [Spells.LastStandBuff]: noThreat,
    [Spells.ShieldBlock]: noThreat,
    [Spells.BloodthirstBuffR1]: noThreat,
    [Spells.BloodthirstBuffR2]: noThreat,

    // Heroic Strike ranks
    [Spells.HeroicStrikeR1]: threatOnHit(16),
    [Spells.HeroicStrikeR2]: threatOnHit(39),
    [Spells.HeroicStrikeR3]: threatOnHit(59),
    [Spells.HeroicStrikeR4]: threatOnHit(78),
    [Spells.HeroicStrikeR5]: threatOnHit(98),
    [Spells.HeroicStrikeR6]: threatOnHit(118),
    [Spells.HeroicStrikeR7]: threatOnHit(137),
    [Spells.HeroicStrikeR8]: threatOnHit(145),
    [Spells.HeroicStrikeR9]: threatOnHit(175),

    // Shield Slam ranks
    [Spells.ShieldSlamR1]: threatOnHit(178),
    [Spells.ShieldSlamR2]: threatOnHit(203),
    [Spells.ShieldSlamR3]: threatOnHit(229),
    [Spells.ShieldSlamR4]: threatOnHit(254),

    // Shield Bash ranks
    [Spells.ShieldBashR1]: modDamagePlusThreat(1.5, 36),
    [Spells.ShieldBashR2]: modDamagePlusThreat(1.5, 96),
    [Spells.ShieldBashR3]: modDamagePlusThreat(1.5, 96),

    // Revenge ranks
    [Spells.RevengeR5]: modDamagePlusThreat(2.25, 243),
    [Spells.RevengeR6]: modDamagePlusThreat(2.25, 270),

    // Cleave ranks
    [Spells.CleaveR1]: threatOnHit(10),
    [Spells.CleaveR2]: threatOnHit(40),
    [Spells.CleaveR3]: threatOnHit(60),
    [Spells.CleaveR4]: threatOnHit(70),
    [Spells.CleaveR5]: threatOnHit(100),
    [Spells.CleaveR6]: threatOnHit(100),

    [Spells.WhirlwindR1]: modDamage(1.25),
    [Spells.MortalStrike]: calculateThreat({ eventTypes: ['damage'] }),

    // Thunder Clap ranks
    [Spells.ThunderClapR1]: modDamage(2.5),
    [Spells.ThunderClapR2]: modDamage(2.5),
    [Spells.ThunderClapR3]: modDamage(2.5),
    [Spells.ThunderClapR4]: modDamage(2.5),
    [Spells.ThunderClapR5]: modDamage(2.5),
    [Spells.ThunderClapR6]: modDamage(2.5),
    [Spells.ThunderClapR7]: modDamage(2.5),

    // Hamstring ranks
    [Spells.HamstringR1]: modDamagePlusThreat(1.25, 20),
    [Spells.HamstringR2]: modDamagePlusThreat(1.25, 80),
    [Spells.HamstringR3]: threatOnHit(145),
    [Spells.HamstringR4]: threatOnHit(145),

    // Intercept ranks
    [Spells.InterceptR1]: modDamage(2),
    [Spells.InterceptStunR1]: noThreat,
    [Spells.InterceptR2]: modDamage(2),
    [Spells.InterceptStunR2]: noThreat,
    [Spells.InterceptR3]: modDamage(2),
    [Spells.InterceptStunR3]: noThreat,

    // Execute ranks
    [Spells.ExecuteR6]: modDamage(1.25),
    [Spells.ExecuteR7]: modDamage(1.25),

    // Sunder Armor ranks
    [Spells.SunderArmorR1]: threatOnCastRollbackOnMiss(45),
    [Spells.SunderArmorR2]: threatOnCastRollbackOnMiss(90),
    [Spells.SunderArmorR3]: threatOnCastRollbackOnMiss(135),
    [Spells.SunderArmorR5]: threatOnCastRollbackOnMiss(261),

    // Battle Shout ranks
    [Spells.BattleShoutR1]: threatOnBuff(1, { split: true }),
    [Spells.BattleShoutR2]: threatOnBuff(12, { split: true }),
    [Spells.BattleShoutR3]: threatOnBuff(22, { split: true }),
    [Spells.BattleShoutR4]: threatOnBuff(32, { split: true }),
    [Spells.BattleShoutR5]: threatOnBuff(42, { split: true }),
    [Spells.BattleShoutR6]: threatOnBuff(52, { split: true }),
    [Spells.BattleShoutR7]: threatOnBuff(60, { split: true }),

    // Demoralizing Shout ranks
    [Spells.DemoShoutR5]: threatOnDebuff(43),
    [Spells.DemoShoutR7]: threatOnDebuff(43),

    // Mocking Blow ranks
    [Spells.MockingBlowR1]: calculateThreat({ eventTypes: ['damage'] }),
    [Spells.MockingBlowR2]: calculateThreat({ eventTypes: ['damage'] }),
    [Spells.MockingBlowR3]: calculateThreat({ eventTypes: ['damage'] }),
    [Spells.MockingBlowR4]: calculateThreat({ eventTypes: ['damage'] }),
    [Spells.MockingBlowR5]: calculateThreat({ eventTypes: ['damage'] }),

    // Taunt / fixate abilities
    [Spells.Taunt]: tauntTarget({
      bonus: 0,
      eventTypes: ['applydebuff'],
    }),
    [Spells.ChallengingShout]: noThreat,

    // Direct damage / on-hit physical abilities
    [Spells.OverpowerR4]: calculateThreat({ eventTypes: ['damage'] }),
    [Spells.RendR6]: calculateThreat({ eventTypes: ['damage'] }),
    [Spells.DeepWounds]: calculateThreat({ eventTypes: ['damage'] }),
    [Spells.PummelR1]: threatOnHit(76),
    [Spells.PummelR2]: threatOnHit(116),
    [Spells.BloodthirstR1]: calculateThreat({ eventTypes: ['damage'] }),
    [Spells.BloodthirstR2]: calculateThreat({ eventTypes: ['damage'] }),
    [Spells.BloodthirstR3]: calculateThreat({ eventTypes: ['damage'] }),
    [Spells.BloodthirstR4]: calculateThreat({ eventTypes: ['damage'] }),

    // Resource gain and proc heal abilities
    [Spells.BloodrageCast]: resourceChangeThreat(true),
    [Spells.BloodrageRageGain]: resourceChangeThreat(false),
    [Spells.UnbridledWrath]: resourceChangeThreat(false),
    [Spells.BloodthirstHeal]: calculateThreat({
      modifier: 0.5,
      split: true,
      eventTypes: ['heal'],
    }),
  },

  fixateBuffs: new Set([
    Spells.Taunt,
    Spells.ChallengingShout,
    Spells.MockingBlowR1,
    Spells.MockingBlowR2,
    Spells.MockingBlowR3,
    Spells.MockingBlowR4,
    Spells.MockingBlowR5,
  ]),

  talentImplications: (ctx: TalentImplicationContext) => {
    const defianceRank = inferDefianceRank(ctx)
    if (defianceRank === 0) {
      return []
    }

    return [DEFIANCE_AURA_BY_RANK[defianceRank - 1]!]
  },

  gearImplications: inferGearAuras,
}
