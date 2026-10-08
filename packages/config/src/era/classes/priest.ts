/**
 * Priest Threat Configuration - Anniversary Edition
 *
 * Mind Blast generates extra threat. Silent Resolve and Shadow Affinity talents reduce threat.
 */
import type {
  ClassThreatConfig,
  TalentImplicationContext,
} from '@wow-threat/shared'
import { SpellSchool } from '@wow-threat/shared'
import type { GearItem } from '@wow-threat/wcl-types'

import { noThreat, threat } from '../../shared/formulas'
import { inferTalent } from '../../shared/talents'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  // Healing spells affected by Vestments of Faith 6-piece
  LesserHealR1: 2050, // https://www.wowhead.com/classic/spell=2050/
  LesserHealR2: 2052, // https://www.wowhead.com/classic/spell=2052/
  LesserHealR3: 2053, // https://www.wowhead.com/classic/spell=2053/
  HealR1: 2054, // https://www.wowhead.com/classic/spell=2054/
  HealR2: 2055, // https://www.wowhead.com/classic/spell=2055/
  HealR3: 6063, // https://www.wowhead.com/classic/spell=6063/
  HealR4: 6064, // https://www.wowhead.com/classic/spell=6064/
  GreaterHealR1: 2060, // https://www.wowhead.com/classic/spell=2060/
  GreaterHealR2: 10963, // https://www.wowhead.com/classic/spell=10963/
  GreaterHealR3: 10964, // https://www.wowhead.com/classic/spell=10964/
  GreaterHealR4: 10965, // https://www.wowhead.com/classic/spell=10965/
  GreaterHealR5: 25314, // https://www.wowhead.com/classic/spell=25314/
  FlashHealR1: 2061, // https://www.wowhead.com/classic/spell=2061/
  FlashHealR2: 9472, // https://www.wowhead.com/classic/spell=9472/
  FlashHealR3: 9473, // https://www.wowhead.com/classic/spell=9473/
  FlashHealR4: 9474, // https://www.wowhead.com/classic/spell=9474/
  FlashHealR5: 10915, // https://www.wowhead.com/classic/spell=10915/
  FlashHealR6: 10916, // https://www.wowhead.com/classic/spell=10916/
  FlashHealR7: 10917, // https://www.wowhead.com/classic/spell=10917/
  RenewR1: 139, // https://www.wowhead.com/classic/spell=139/
  RenewR2: 6074, // https://www.wowhead.com/classic/spell=6074/
  RenewR3: 6075, // https://www.wowhead.com/classic/spell=6075/
  RenewR4: 6076, // https://www.wowhead.com/classic/spell=6076/
  RenewR5: 6077, // https://www.wowhead.com/classic/spell=6077/
  RenewR6: 6078, // https://www.wowhead.com/classic/spell=6078/
  RenewR7: 10927, // https://www.wowhead.com/classic/spell=10927/
  RenewR8: 10928, // https://www.wowhead.com/classic/spell=10928/
  RenewR9: 10929, // https://www.wowhead.com/classic/spell=10929/
  RenewR10: 25315, // https://www.wowhead.com/classic/spell=25315/
  PrayerOfHealingR1: 596, // https://www.wowhead.com/classic/spell=596/
  PrayerOfHealingR2: 996, // https://www.wowhead.com/classic/spell=996/
  PrayerOfHealingR3: 10960, // https://www.wowhead.com/classic/spell=10960/
  PrayerOfHealingR4: 10961, // https://www.wowhead.com/classic/spell=10961/
  PrayerOfHealingR5: 25316, // https://www.wowhead.com/classic/spell=25316/
  DesperatePrayerR1: 13908, // https://www.wowhead.com/classic/spell=13908/
  DesperatePrayerR2: 19236, // https://www.wowhead.com/classic/spell=19236/
  DesperatePrayerR3: 19238, // https://www.wowhead.com/classic/spell=19238/
  DesperatePrayerR4: 19240, // https://www.wowhead.com/classic/spell=19240/
  DesperatePrayerR5: 19241, // https://www.wowhead.com/classic/spell=19241/
  DesperatePrayerR6: 19242, // https://www.wowhead.com/classic/spell=19242/
  DesperatePrayerR7: 19243, // https://www.wowhead.com/classic/spell=19243/

  // Mind Blast (extra threat per rank)
  MindBlastR1: 8092, // https://www.wowhead.com/classic/spell=8092/
  MindBlastR2: 8102, // https://www.wowhead.com/classic/spell=8102/
  MindBlastR3: 8103, // https://www.wowhead.com/classic/spell=8103/
  MindBlastR4: 8104, // https://www.wowhead.com/classic/spell=8104/
  MindBlastR5: 8105, // https://www.wowhead.com/classic/spell=8105/
  MindBlastR6: 8106, // https://www.wowhead.com/classic/spell=8106/
  MindBlastR7: 10945, // https://www.wowhead.com/classic/spell=10945/
  MindBlastR8: 10946, // https://www.wowhead.com/classic/spell=10946/
  MindBlastR9: 10947, // https://www.wowhead.com/classic/spell=10947/

  // Holy Nova - zero threat
  HolyNovaDmgR1: 15237, // https://www.wowhead.com/classic/spell=15237/
  HolyNovaDmgR2: 15430, // https://www.wowhead.com/classic/spell=15430/
  HolyNovaDmgR3: 15431, // https://www.wowhead.com/classic/spell=15431/
  HolyNovaDmgR4: 27799, // https://www.wowhead.com/classic/spell=27799/
  HolyNovaDmgR5: 27800, // https://www.wowhead.com/classic/spell=27800/
  HolyNovaDmgR6: 27801, // https://www.wowhead.com/classic/spell=27801/
  HolyNovaHealR1: 23455, // https://www.wowhead.com/classic/spell=23455/
  HolyNovaHealR2: 23458, // https://www.wowhead.com/classic/spell=23458/
  HolyNovaHealR3: 23459, // https://www.wowhead.com/classic/spell=23459/
  HolyNovaHealR4: 27803, // https://www.wowhead.com/classic/spell=27803/
  HolyNovaHealR5: 27804, // https://www.wowhead.com/classic/spell=27804/
  HolyNovaHealR6: 27805, // https://www.wowhead.com/classic/spell=27805/

  // Weakened Soul - zero threat
  WeakenedSoul: 6788, // https://www.wowhead.com/classic/spell=6788/

  // Talents (synthetic aura IDs inferred from combatantinfo)
  SilentResolveRank1: 14523, // https://www.wowhead.com/classic/spell=14523/
  SilentResolveRank2: 14784, // https://www.wowhead.com/classic/spell=14784/
  SilentResolveRank3: 14785, // https://www.wowhead.com/classic/spell=14785/
  SilentResolveRank4: 14786, // https://www.wowhead.com/classic/spell=14786/
  SilentResolveRank5: 14787, // https://www.wowhead.com/classic/spell=14787/
  ShadowAffinityRank1: 15318, // https://www.wowhead.com/classic/spell=15318/
  ShadowAffinityRank2: 15319, // https://www.wowhead.com/classic/spell=15319/
  ShadowAffinityRank3: 15320, // https://www.wowhead.com/classic/spell=15320/

  // Vestments of Faith 6-piece
  VestmentsReducedThreat: 28808, // https://www.wowhead.com/classic/spell=28808/
} as const

export const SetIds = {
  VestmentsOfFaith: 525,
} as const

const Mods = {
  SilentResolve: 0.04, // 4% per rank (up to 20%)
  VestmentsOfFaith: 0.9,
}

export const VestmentsHealSpellIds = new Set([
  Spells.LesserHealR1,
  Spells.LesserHealR2,
  Spells.LesserHealR3,
  Spells.HealR1,
  Spells.HealR2,
  Spells.HealR3,
  Spells.HealR4,
  Spells.GreaterHealR1,
  Spells.GreaterHealR2,
  Spells.GreaterHealR3,
  Spells.GreaterHealR4,
  Spells.GreaterHealR5,
  Spells.FlashHealR1,
  Spells.FlashHealR2,
  Spells.FlashHealR3,
  Spells.FlashHealR4,
  Spells.FlashHealR5,
  Spells.FlashHealR6,
  Spells.FlashHealR7,
  Spells.RenewR1,
  Spells.RenewR2,
  Spells.RenewR3,
  Spells.RenewR4,
  Spells.RenewR5,
  Spells.RenewR6,
  Spells.RenewR7,
  Spells.RenewR8,
  Spells.RenewR9,
  Spells.RenewR10,
  Spells.PrayerOfHealingR1,
  Spells.PrayerOfHealingR2,
  Spells.PrayerOfHealingR3,
  Spells.PrayerOfHealingR4,
  Spells.PrayerOfHealingR5,
  Spells.DesperatePrayerR1,
  Spells.DesperatePrayerR2,
  Spells.DesperatePrayerR3,
  Spells.DesperatePrayerR4,
  Spells.DesperatePrayerR5,
  Spells.DesperatePrayerR6,
  Spells.DesperatePrayerR7,
  Spells.HolyNovaHealR1,
  Spells.HolyNovaHealR2,
  Spells.HolyNovaHealR3,
  Spells.HolyNovaHealR4,
  Spells.HolyNovaHealR5,
  Spells.HolyNovaHealR6,
])

const SILENT_RESOLVE_RANKS = [
  Spells.SilentResolveRank1,
  Spells.SilentResolveRank2,
  Spells.SilentResolveRank3,
  Spells.SilentResolveRank4,
  Spells.SilentResolveRank5,
] as const
const SHADOW_AFFINITY_RANKS = [
  Spells.ShadowAffinityRank1,
  Spells.ShadowAffinityRank2,
  Spells.ShadowAffinityRank3,
] as const

const SHADOW = 2

function inferGearAuras(gear: GearItem[]): number[] {
  const vestmentsPieces = gear.filter(
    (item) => item.setID === SetIds.VestmentsOfFaith,
  ).length

  return vestmentsPieces >= 6 ? [Spells.VestmentsReducedThreat] : []
}

// ============================================================================
// Configuration
// ============================================================================

export const priestConfig: ClassThreatConfig = {
  auraModifiers: {
    // Silent Resolve - all spell threat reduction
    [Spells.SilentResolveRank1]: () => ({
      source: 'talent',
      name: 'Silent Resolve (Rank 1)',
      value: 1 - Mods.SilentResolve,
    }),
    [Spells.SilentResolveRank2]: () => ({
      source: 'talent',
      name: 'Silent Resolve (Rank 2)',
      value: 1 - Mods.SilentResolve * 2,
    }),
    [Spells.SilentResolveRank3]: () => ({
      source: 'talent',
      name: 'Silent Resolve (Rank 3)',
      value: 1 - Mods.SilentResolve * 3,
    }),
    [Spells.SilentResolveRank4]: () => ({
      source: 'talent',
      name: 'Silent Resolve (Rank 4)',
      value: 1 - Mods.SilentResolve * 4,
    }),
    [Spells.SilentResolveRank5]: () => ({
      source: 'talent',
      name: 'Silent Resolve (Rank 5)',
      value: 1 - Mods.SilentResolve * 5,
    }),

    // Shadow Affinity - shadow spell threat reduction
    [Spells.ShadowAffinityRank1]: () => ({
      source: 'talent',
      name: 'Shadow Affinity (Rank 1)',
      value: 0.92,
      schoolMask: SpellSchool.Shadow,
    }),
    [Spells.ShadowAffinityRank2]: () => ({
      source: 'talent',
      name: 'Shadow Affinity (Rank 2)',
      value: 0.84,
      schoolMask: SpellSchool.Shadow,
    }),
    [Spells.ShadowAffinityRank3]: () => ({
      source: 'talent',
      name: 'Shadow Affinity (Rank 3)',
      value: 0.75,
      schoolMask: SpellSchool.Shadow,
    }),

    [Spells.VestmentsReducedThreat]: () => ({
      source: 'gear',
      name: 'Vestments of Faith (6-piece)',
      value: Mods.VestmentsOfFaith,
      spellIds: VestmentsHealSpellIds,
    }),
  },

  abilities: {
    // Mind Blast - damage + flat threat per rank
    [Spells.MindBlastR1]: threat({ modifier: 1, bonus: 40 }),
    [Spells.MindBlastR2]: threat({ modifier: 1, bonus: 77 }),
    [Spells.MindBlastR3]: threat({ modifier: 1, bonus: 121 }),
    [Spells.MindBlastR4]: threat({ modifier: 1, bonus: 180 }),
    [Spells.MindBlastR5]: threat({ modifier: 1, bonus: 236 }),
    [Spells.MindBlastR6]: threat({ modifier: 1, bonus: 303 }),
    [Spells.MindBlastR7]: threat({ modifier: 1, bonus: 380 }),
    [Spells.MindBlastR8]: threat({ modifier: 1, bonus: 460 }),
    [Spells.MindBlastR9]: threat({ modifier: 1, bonus: 540 }),

    // Holy Nova - zero threat
    [Spells.HolyNovaDmgR1]: noThreat(),
    [Spells.HolyNovaDmgR2]: noThreat(),
    [Spells.HolyNovaDmgR3]: noThreat(),
    [Spells.HolyNovaDmgR4]: noThreat(),
    [Spells.HolyNovaDmgR5]: noThreat(),
    [Spells.HolyNovaDmgR6]: noThreat(),
    [Spells.HolyNovaHealR1]: noThreat(),
    [Spells.HolyNovaHealR2]: noThreat(),
    [Spells.HolyNovaHealR3]: noThreat(),
    [Spells.HolyNovaHealR4]: noThreat(),
    [Spells.HolyNovaHealR5]: noThreat(),
    [Spells.HolyNovaHealR6]: noThreat(),

    // Weakened Soul - zero threat
    [Spells.WeakenedSoul]: noThreat(),
  },

  gearImplications: inferGearAuras,

  talentImplications: (ctx: TalentImplicationContext) => {
    const syntheticAuras: number[] = []

    const silentResolveSpellId = inferTalent(ctx, SILENT_RESOLVE_RANKS)
    // healing builds typically dont have silent resolve so we wont do any
    // point inference
    if (silentResolveSpellId) {
      syntheticAuras.push(silentResolveSpellId)
    }

    const shadowAffinitySpellId = inferTalent(
      ctx,
      SHADOW_AFFINITY_RANKS,
      (points) => {
        return points[SHADOW] >= 21 ? 3 : 0
      },
    )
    if (shadowAffinitySpellId) {
      syntheticAuras.push(shadowAffinitySpellId)
    }

    return syntheticAuras
  },
}
