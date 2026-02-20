/**
 * Anniversary warrior deltas over Era.
 *
 * Adds TBC-only ranks and overrides warrior threat behavior where TBC differs
 * from Era defaults.
 */
import type {
  ClassThreatConfig,
  SpellId,
  TalentImplicationContext,
} from '@wow-threat/shared'

import {
  SetIds as EraSetIds,
  Spells as EraSpells,
  warriorConfig as eraWarriorConfig,
} from '../../era/classes/warrior'
import {
  noThreat,
  threat,
  threatOnBuff,
  threatOnCastRollbackOnMiss,
  threatOnDebuff,
  threatOnSuccessfulHit,
} from '../../shared/formulas'
import { inferTalent } from '../../shared/talents'

export const Spells = {
  ...EraSpells,

  HeroicStrikeR10: 29707,
  HeroicStrikeR11: 30324,

  ShieldSlamR5: 25258,
  ShieldSlamR6: 30356,

  ShieldBashR4: 29704,

  RevengeR7: 25269,
  RevengeR8: 30357,

  DevastateR1: 20243,
  DevastateR2: 30016,
  DevastateR3: 30022,

  BattleShoutR8: 2048,
  CommandingShout: 469,
  SpellReflect: 23920,
  SunderArmorR6: 25225,

  ImprovedBerserkerStanceRank1: 910001,
  ImprovedBerserkerStanceRank2: 910002,
  ImprovedBerserkerStanceRank3: 910003,
  ImprovedBerserkerStanceRank4: 910004,
  ImprovedBerserkerStanceRank5: 910005,

  TacticalMasteryRank1: 910011,
  TacticalMasteryRank2: 910012,
  TacticalMasteryRank3: 910013,
} as const

export const SetIds = {
  ...EraSetIds,
}

const IMPROVED_BERSERKER_STANCE_RANKS = [
  Spells.ImprovedBerserkerStanceRank1,
  Spells.ImprovedBerserkerStanceRank2,
  Spells.ImprovedBerserkerStanceRank3,
  Spells.ImprovedBerserkerStanceRank4,
  Spells.ImprovedBerserkerStanceRank5,
] as const

const TACTICAL_MASTERY_RANKS = [
  Spells.TacticalMasteryRank1,
  Spells.TacticalMasteryRank2,
  Spells.TacticalMasteryRank3,
] as const

const DEFIANCE_TBC_RANKS = [
  Spells.DefianceRank1,
  Spells.DefianceRank2,
  Spells.DefianceRank3,
] as const

const ARMS = 0
const FURY = 1
const PROT = 2

const IMPROVED_BERSERKER_STANCE_THRESHOLD = 35
const TACTICAL_MASTERY_THRESHOLD = 3
const DEFIANCE_TBC_THRESHOLD = 10

const TACTICAL_MASTERY_SPELLS = new Set<SpellId>([
  Spells.BloodthirstR1,
  Spells.BloodthirstR2,
  Spells.BloodthirstR3,
  Spells.BloodthirstR4,
  Spells.BloodthirstHeal,
  12294, // Mortal Strike rank 1
  21551, // Mortal Strike rank 2
  21552, // Mortal Strike rank 3
  21553, // Mortal Strike rank 4
  25248, // Mortal Strike rank 5
  30330, // Mortal Strike rank 6
])

function buildAuraImplications():
  | Map<SpellId, ReadonlySet<SpellId>>
  | undefined {
  const inherited = eraWarriorConfig.auraImplications
  const merged = new Map<SpellId, ReadonlySet<SpellId>>(inherited ?? [])

  const battleStance = new Set(merged.get(Spells.BattleStance) ?? [])
  battleStance.delete(Spells.ThunderClapR1)
  battleStance.delete(Spells.ThunderClapR2)
  battleStance.delete(Spells.ThunderClapR3)
  battleStance.delete(Spells.ThunderClapR4)
  battleStance.delete(Spells.ThunderClapR5)
  battleStance.delete(Spells.ThunderClapR6)
  battleStance.delete(Spells.SweepingStrikes)
  merged.set(Spells.BattleStance, battleStance)

  const defensiveStance = new Set(merged.get(Spells.DefensiveStance) ?? [])
  defensiveStance.add(Spells.ShieldSlamR1)
  defensiveStance.add(Spells.ShieldSlamR2)
  defensiveStance.add(Spells.ShieldSlamR3)
  defensiveStance.add(Spells.ShieldSlamR4)
  defensiveStance.add(Spells.ShieldSlamR5)
  defensiveStance.add(Spells.ShieldSlamR6)
  defensiveStance.add(Spells.RevengeR7)
  defensiveStance.add(Spells.RevengeR8)
  merged.set(Spells.DefensiveStance, defensiveStance)

  return merged
}

const noThreatFormula = noThreat()

export const warriorConfig: ClassThreatConfig = {
  ...eraWarriorConfig,
  auraImplications: buildAuraImplications(),

  auraModifiers: {
    ...eraWarriorConfig.auraModifiers,

    [Spells.DefianceRank1]: (ctx) => ({
      source: 'talent',
      name: 'Defiance (Rank 1)',
      value: ctx.sourceAuras.has(Spells.DefensiveStance) ? 1.05 : 1,
    }),
    [Spells.DefianceRank2]: (ctx) => ({
      source: 'talent',
      name: 'Defiance (Rank 2)',
      value: ctx.sourceAuras.has(Spells.DefensiveStance) ? 1.1 : 1,
    }),
    [Spells.DefianceRank3]: (ctx) => ({
      source: 'talent',
      name: 'Defiance (Rank 3)',
      value: ctx.sourceAuras.has(Spells.DefensiveStance) ? 1.15 : 1,
    }),

    [Spells.ImprovedBerserkerStanceRank1]: (ctx) => ({
      source: 'talent',
      name: 'Improved Berserker Stance (Rank 1)',
      value: ctx.sourceAuras.has(Spells.BerserkerStance) ? 0.98 : 1,
    }),
    [Spells.ImprovedBerserkerStanceRank2]: (ctx) => ({
      source: 'talent',
      name: 'Improved Berserker Stance (Rank 2)',
      value: ctx.sourceAuras.has(Spells.BerserkerStance) ? 0.96 : 1,
    }),
    [Spells.ImprovedBerserkerStanceRank3]: (ctx) => ({
      source: 'talent',
      name: 'Improved Berserker Stance (Rank 3)',
      value: ctx.sourceAuras.has(Spells.BerserkerStance) ? 0.94 : 1,
    }),
    [Spells.ImprovedBerserkerStanceRank4]: (ctx) => ({
      source: 'talent',
      name: 'Improved Berserker Stance (Rank 4)',
      value: ctx.sourceAuras.has(Spells.BerserkerStance) ? 0.92 : 1,
    }),
    [Spells.ImprovedBerserkerStanceRank5]: (ctx) => ({
      source: 'talent',
      name: 'Improved Berserker Stance (Rank 5)',
      value: ctx.sourceAuras.has(Spells.BerserkerStance) ? 0.9 : 1,
    }),

    [Spells.TacticalMasteryRank1]: (ctx) => ({
      source: 'talent',
      name: 'Tactical Mastery (Rank 1)',
      spellIds: TACTICAL_MASTERY_SPELLS,
      value: ctx.sourceAuras.has(Spells.DefensiveStance) ? 1.21 : 1,
    }),
    [Spells.TacticalMasteryRank2]: (ctx) => ({
      source: 'talent',
      name: 'Tactical Mastery (Rank 2)',
      spellIds: TACTICAL_MASTERY_SPELLS,
      value: ctx.sourceAuras.has(Spells.DefensiveStance) ? 1.42 : 1,
    }),
    [Spells.TacticalMasteryRank3]: (ctx) => ({
      source: 'talent',
      name: 'Tactical Mastery (Rank 3)',
      spellIds: TACTICAL_MASTERY_SPELLS,
      value: ctx.sourceAuras.has(Spells.DefensiveStance) ? 1.63 : 1,
    }),
  },

  abilities: {
    ...eraWarriorConfig.abilities,

    [Spells.HeroicStrikeR9]: threatOnSuccessfulHit({ bonus: 173 }),
    [Spells.HeroicStrikeR10]: threatOnSuccessfulHit({ bonus: 194 }),
    [Spells.HeroicStrikeR11]: threatOnSuccessfulHit({ bonus: 220 }),

    [Spells.ShieldSlamR4]: threatOnSuccessfulHit({ bonus: 254 }),
    [Spells.ShieldSlamR5]: threatOnSuccessfulHit({ bonus: 278 }),
    [Spells.ShieldSlamR6]: threatOnSuccessfulHit({ bonus: 305 }),

    [Spells.ShieldBashR3]: threatOnSuccessfulHit({
      modifier: 1.5,
      bonus: 156,
    }),
    [Spells.ShieldBashR4]: threatOnSuccessfulHit({
      modifier: 1.5,
      bonus: 192,
    }),

    [Spells.RevengeR5]: threatOnSuccessfulHit({ bonus: 150 }),
    [Spells.RevengeR6]: threatOnSuccessfulHit({ bonus: 175 }),
    [Spells.RevengeR7]: threatOnSuccessfulHit({ bonus: 185 }),
    [Spells.RevengeR8]: threatOnSuccessfulHit({ bonus: 200 }),
    [Spells.RevengeStun]: threatOnSuccessfulHit({ bonus: 20 }),

    [Spells.DevastateR1]: threatOnSuccessfulHit({ bonus: 401.5 }),
    [Spells.DevastateR2]: threatOnSuccessfulHit({ bonus: 401.5 }),
    [Spells.DevastateR3]: threatOnSuccessfulHit({ bonus: 401.5 }),

    [Spells.ThunderClapR1]: threat({ modifier: 1.75 }),
    [Spells.ThunderClapR2]: threat({ modifier: 1.75 }),
    [Spells.ThunderClapR3]: threat({ modifier: 1.75 }),
    [Spells.ThunderClapR4]: threat({ modifier: 1.75 }),
    [Spells.ThunderClapR5]: threat({ modifier: 1.75 }),
    [Spells.ThunderClapR6]: threat({ modifier: 1.75 }),

    [Spells.SunderArmorR1]: threatOnCastRollbackOnMiss(45),
    [Spells.SunderArmorR5]: threatOnCastRollbackOnMiss(261),
    [Spells.SunderArmorR6]: threatOnCastRollbackOnMiss(301.5),

    [Spells.BattleShoutR6]: threatOnBuff(52, { split: false }),
    [Spells.BattleShoutR7]: threatOnBuff(60, { split: false }),
    [Spells.BattleShoutR8]: threatOnBuff(69, { split: false }),

    [Spells.DemoShoutR5]: threatOnDebuff(43),
    [Spells.DemoShoutR7]: threatOnDebuff(56),

    [Spells.CommandingShout]: threatOnBuff(69, { split: false }),
    [Spells.SpellReflect]: noThreatFormula,
    [Spells.SweepingStrikes]: noThreatFormula,
  },

  talentImplications: (ctx: TalentImplicationContext) => {
    const inheritedAuras = eraWarriorConfig.talentImplications?.(ctx) ?? []
    const withoutDefiance = inheritedAuras.filter(
      (spellId) =>
        spellId !== Spells.DefianceRank1 &&
        spellId !== Spells.DefianceRank2 &&
        spellId !== Spells.DefianceRank3 &&
        spellId !== Spells.DefianceRank4 &&
        spellId !== Spells.DefianceRank5,
    )

    const defianceSpellId = inferTalent(ctx, DEFIANCE_TBC_RANKS, (points) =>
      points[PROT] >= DEFIANCE_TBC_THRESHOLD ? DEFIANCE_TBC_RANKS.length : 0,
    )
    if (defianceSpellId) {
      withoutDefiance.push(defianceSpellId as SpellId)
    }

    const improvedBerserkerStanceSpellId = inferTalent(
      ctx,
      IMPROVED_BERSERKER_STANCE_RANKS,
      (points) =>
        points[FURY] >= IMPROVED_BERSERKER_STANCE_THRESHOLD
          ? IMPROVED_BERSERKER_STANCE_RANKS.length
          : 0,
    )
    if (improvedBerserkerStanceSpellId) {
      withoutDefiance.push(improvedBerserkerStanceSpellId as SpellId)
    }

    const tacticalMasterySpellId = inferTalent(
      ctx,
      TACTICAL_MASTERY_RANKS,
      (points) =>
        points[ARMS] >= TACTICAL_MASTERY_THRESHOLD
          ? TACTICAL_MASTERY_RANKS.length
          : 0,
    )
    if (tacticalMasterySpellId) {
      withoutDefiance.push(tacticalMasterySpellId as SpellId)
    }

    return withoutDefiance
  },
}
