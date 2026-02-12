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
  // Abilities
  ShieldSlam: 23922,
  Revenge: 25288,
  SunderArmor: 25225,
  HeroicStrike: 25286,
  Cleave: 25231,
  Execute: 25236,
  Whirlwind: 25248,
  Thunderclap: 23931,
  DemoShout: 25203,
  BattleShout: 25289,
  Taunt: 355,
  MockingBlow: 20560,
  ChallengingShout: 1161,
  ShieldBash: 1672,
  Hamstring: 25212,
  Disarm: 676,
  Overpower: 11585,
  Bloodthirst: 23894,
  MortalStrike: 25248,

  // Stances
  DefensiveStance: 71,
  BerserkerStance: 2458,
  BattleStance: 2457,

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
  const t1Pieces = gear.filter((g) => g.setID === SetIds.T1).length
  return t1Pieces >= 8 ? [Spells.T1_8pc] : []
}

const BATTLE_STANCE_IMPLIED_ABILITIES: ReadonlySet<SpellId> = new Set([
  // Overpower
  7384,
  7887,
  11584,
  Spells.Overpower,
  // Charge
  100,
  6178,
  11578,
  // Thunder Clap (all ranks)
  6343,
  8198,
  8204,
  8205,
  11580,
  11581,
  // Mocking Blow (all ranks)
  694,
  7400,
  7402,
  20559,
  Spells.MockingBlow,
  20230, // Retaliation
  12292, // Sweeping Strikes
])

const BERSERKER_STANCE_IMPLIED_ABILITIES: ReadonlySet<SpellId> = new Set([
  // Intercept
  20252,
  20617,
  20616,
  1680, // Whirlwind
  18499, // Berserker Rage
  1719, // Recklessness
  6552,
  6554, // Pummel
])

const DEFENSIVE_STANCE_IMPLIED_ABILITIES: ReadonlySet<SpellId> = new Set([
  Spells.Taunt,
  Spells.Disarm,
  6572,
  6574,
  7379,
  11600,
  11601,
  Spells.Revenge,
  2565, // Shield Block
  871, // Shield Wall
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
    // Stances
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

    // Battle Stance is 1.0, no modifier needed (omitted)

    // Defiance talent (different ranks)
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

    // Gear set bonuses
    [Spells.T1_8pc]: () => ({
      source: 'gear',
      name: 'Might 8pc',
      spellIds: new Set([Spells.SunderArmor]),
      value: 1.15,
    }),
    [Spells.T25_4pc]: () => ({
      source: 'gear',
      name: 'Conqueror 4pc',

      value: 1.1,
    }),
  },

  abilities: {
    // Shield Slam: 2x damage + 150 flat threat
    [Spells.ShieldSlam]: calculateThreat({ modifier: 2, bonus: 150 }),

    // Sunder Armor: threat on cast, rollback on miss/immune/resist
    [Spells.SunderArmor]: threatOnCastRollbackOnMiss(301),

    // Revenge: damage + 355 flat threat
    [Spells.Revenge]: calculateThreat({ modifier: 1, bonus: 355 }),

    // Heroic Strike: damage + 145 flat threat
    [Spells.HeroicStrike]: calculateThreat({ modifier: 1, bonus: 145 }),

    // Cleave: damage + 100 flat threat per target
    [Spells.Cleave]: calculateThreat({ modifier: 1, bonus: 100 }),

    // Thunder Clap: damage + 175 flat threat
    [Spells.Thunderclap]: calculateThreat({ modifier: 1, bonus: 175 }),

    // Battle Shout: 70 threat split among enemies
    [Spells.BattleShout]: threatOnBuff(70, { split: true }),

    // Demo Shout: 56 threat per target hit
    [Spells.DemoShout]: threatOnDebuff(56),

    // Shield Bash: damage + 187 flat threat
    [Spells.ShieldBash]: calculateThreat({ modifier: 1, bonus: 187 }),

    // Hamstring: damage + 141 flat threat
    [Spells.Hamstring]: calculateThreat({ modifier: 1, bonus: 141 }),

    // Disarm: damage + 104 flat threat
    [Spells.Disarm]: calculateThreat({ modifier: 1, bonus: 104 }),

    // Taunt: match top threat + 1
    [Spells.Taunt]: tauntTarget({ bonus: 1 }),

    // Mocking Blow: match top threat + damage
    [Spells.MockingBlow]: tauntTarget({ modifier: 1, bonus: 0 }),

    // Challenging Shout: match top threat
    [Spells.ChallengingShout]: tauntTarget({ bonus: 0 }),
  },

  fixateBuffs: new Set([
    Spells.Taunt,
    Spells.ChallengingShout,
    Spells.MockingBlow,
    694, // Mocking Blow (other IDs)
    7400,
    7402,
    20559,
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
