/**
 * Warrior Threat Configuration - Anniversary Edition
 *
 * Spell IDs and threat values are based on Classic/Anniversary Edition mechanics.
 */
import { calculateThreat, tauntTarget } from '../../shared/formulas'
import type { ClassThreatConfig, GearItem } from '../../types'

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
  Defiance: 12303, // Rank 5 (15%)
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

    // Sunder Armor: flat 301 threat (no damage in Classic)
    [Spells.SunderArmor]: calculateThreat({ modifier: 0, bonus: 301 }),

    // Revenge: damage + 355 flat threat
    [Spells.Revenge]: calculateThreat({ modifier: 1, bonus: 355 }),

    // Heroic Strike: damage + 145 flat threat
    [Spells.HeroicStrike]: calculateThreat({ modifier: 1, bonus: 145 }),

    // Cleave: damage + 100 flat threat per target
    [Spells.Cleave]: calculateThreat({ modifier: 1, bonus: 100 }),

    // Thunder Clap: damage + 175 flat threat
    [Spells.Thunderclap]: calculateThreat({ modifier: 1, bonus: 175 }),

    // Battle Shout: 70 threat split among enemies
    [Spells.BattleShout]: calculateThreat({
      modifier: 0,
      bonus: 70,
      split: true,
    }),

    // Demo Shout: 56 threat per target hit
    [Spells.DemoShout]: calculateThreat({ modifier: 0, bonus: 56 }),

    // Shield Bash: damage + 187 flat threat
    [Spells.ShieldBash]: calculateThreat({ modifier: 1, bonus: 187 }),

    // Hamstring: damage + 141 flat threat
    [Spells.Hamstring]: calculateThreat({ modifier: 1, bonus: 141 }),

    // Disarm: damage + 104 flat threat
    [Spells.Disarm]: calculateThreat({ modifier: 1, bonus: 104 }),

    // Taunt: match top threat + 1, fixate for 3s
    [Spells.Taunt]: tauntTarget(1, 3000),

    // Mocking Blow: match top threat + damage, fixate for 6s
    [Spells.MockingBlow]: tauntTarget(0, 6000, { addDamage: true }),

    // Challenging Shout: AoE taunt, fixate for 6s
    [Spells.ChallengingShout]: tauntTarget(0, 6000),
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

  gearImplications: (gear: GearItem[]) => {
    const syntheticAuras: number[] = []
    const t1Pieces = gear.filter((g) => g.setID === SetIds.T1).length
    if (t1Pieces >= 8) syntheticAuras.push(Spells.T1_8pc)
    return syntheticAuras
  },
}
