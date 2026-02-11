/**
 * Druid Threat Configuration - Anniversary Edition
 *
 * Spell IDs and threat values are based on Classic/Anniversary Edition mechanics.
 */
import type {
  ClassThreatConfig,
  SpellId,
  TalentImplicationContext,
} from '@wcl-threat/shared'

import {
  calculateThreat,
  noThreat,
  tauntTarget,
  threatOnCastRollbackOnMiss,
  threatOnDebuff,
} from '../../shared/formulas'
import { inferMappedTalentRank } from '../../shared/talents'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  // Forms
  BearForm: 5487,
  DireBearForm: 9634,
  CatForm: 768,
  MoonkinForm: 24858,

  // Bear abilities
  MaulR1: 6807,
  MaulR2: 6808,
  MaulR3: 6809,
  MaulR4: 8972,
  MaulR5: 9745,
  MaulR6: 9880,
  MaulR7: 9881,
  SwipeR1: 779,
  SwipeR2: 780,
  SwipeR3: 769,
  SwipeR4: 9754,
  SwipeR5: 9908,
  DemoRoarR1: 99,
  DemoRoarR2: 1735,
  DemoRoarR3: 9490,
  DemoRoarR4: 9747,
  DemoRoarR5: 9898,
  Growl: 6795,
  ChallengingRoar: 5209,
  Bash: 8983,
  Enrage: 5229,
  Furor: 17057,

  // Cat abilities
  Claw: 9850,
  Shred: 9830,
  Rake: 9904,
  FerociousBite: 22829,
  Ravage: 9867,
  Rip: 9896,
  Pounce: 9827,
  Prowl: 9913,
  TigersFury: 9846,
  DashR1: 1850,
  DashR2: 9821,
  CowerR1: 8998,
  CowerR2: 9000,
  CowerR3: 9892,

  // Faerie Fire
  FaerieFireFeralR1: 16857,
  FaerieFireFeralR2: 17390,
  FaerieFireFeralR3: 17391,
  FaerieFireFeralR4: 17392,
  FaerieFireR1: 770,
  FaerieFireR2: 778,
  FaerieFireR3: 9749,
  FaerieFireR4: 9907,

  // Misc
  Clearcasting: 16870,
  Innervate: 29166,
  FrenziedRegenR1: 22842,
  FrenziedRegenR2: 22895,
  FrenziedRegenR3: 22896,
  LeaderOfThePack: 24932,

  // Talents (synthetic aura IDs inferred from combatantinfo)
  FeralInstinctRank1: 16947,
  FeralInstinctRank2: 16948,
  FeralInstinctRank3: 16949,
  FeralInstinctRank4: 16950,
  FeralInstinctRank5: 16951,
} as const

// ============================================================================
// Modifiers
// ============================================================================

const Mods = {
  Cat: 0.71,
  DireBear: 1.3,
  FeralInstinct: 0.03, // Per talent point (additive with Bear Form)
  Maul: 1.75,
  Swipe: 1.75,
}

const FERAL_INSTINCT_AURA_BY_RANK = [
  Spells.FeralInstinctRank1,
  Spells.FeralInstinctRank2,
  Spells.FeralInstinctRank3,
  Spells.FeralInstinctRank4,
  Spells.FeralInstinctRank5,
] as const
const FERAL_TREE_INDEX = 1
const HIGH_CONFIDENCE_FERAL_INSTINCT_FERAL_POINTS = 31

const FERAL_INSTINCT_RANK_BY_TALENT_ID = new Map<number, number>(
  FERAL_INSTINCT_AURA_BY_RANK.map((spellId, idx) => [spellId, idx + 1]),
)

function inferFeralInstinctRank(ctx: TalentImplicationContext): number {
  const fromRankMap = inferMappedTalentRank(
    ctx.talentRanks,
    FERAL_INSTINCT_RANK_BY_TALENT_ID,
    FERAL_INSTINCT_AURA_BY_RANK.length,
  )
  if (fromRankMap > 0) {
    return fromRankMap
  }

  const feralPoints = Math.trunc(ctx.talentPoints[FERAL_TREE_INDEX] ?? 0)
  if (feralPoints < HIGH_CONFIDENCE_FERAL_INSTINCT_FERAL_POINTS) {
    return 0
  }

  // Legacy payloads can omit per-talent ranks and only include tree splits.
  // In high-confidence deep feral builds, infer max Feral Instinct rank.
  return FERAL_INSTINCT_AURA_BY_RANK.length
}

function hasBearForm(sourceAuras: Set<number>): boolean {
  return (
    sourceAuras.has(Spells.BearForm) || sourceAuras.has(Spells.DireBearForm)
  )
}

function feralInstinctMultiplier(
  rank: number,
  sourceAuras: Set<number>,
): number {
  if (!hasBearForm(sourceAuras)) {
    return 1
  }
  return (Mods.DireBear + Mods.FeralInstinct * rank) / Mods.DireBear
}

const DIRE_BEAR_FORM_IMPLIED_ABILITIES: ReadonlySet<SpellId> = new Set([
  // Maul
  Spells.MaulR1,
  Spells.MaulR2,
  Spells.MaulR3,
  Spells.MaulR4,
  Spells.MaulR5,
  Spells.MaulR6,
  Spells.MaulR7,
  // Swipe
  Spells.SwipeR1,
  Spells.SwipeR2,
  Spells.SwipeR3,
  Spells.SwipeR4,
  Spells.SwipeR5,
  // Demoralizing Roar
  Spells.DemoRoarR1,
  Spells.DemoRoarR2,
  Spells.DemoRoarR3,
  Spells.DemoRoarR4,
  Spells.DemoRoarR5,
  Spells.Growl,
  Spells.Enrage,
  Spells.Furor,
  Spells.Bash,
])

const CAT_FORM_IMPLIED_ABILITIES: ReadonlySet<SpellId> = new Set([
  Spells.Claw,
  Spells.Shred,
  Spells.Rake,
  Spells.FerociousBite,
  Spells.Ravage,
  Spells.Rip,
  Spells.Pounce,
  Spells.Prowl,
  Spells.TigersFury,
  Spells.DashR1,
  Spells.DashR2,
])

// ============================================================================
// Configuration
// ============================================================================

/** Exclusive aura sets - engine auto-removes others when one is applied */
export const exclusiveAuras: Set<number>[] = [
  new Set([
    Spells.BearForm,
    Spells.DireBearForm,
    Spells.CatForm,
    Spells.MoonkinForm,
  ]),
]

export const druidConfig: ClassThreatConfig = {
  exclusiveAuras,

  auraImplications: new Map([
    [Spells.DireBearForm, DIRE_BEAR_FORM_IMPLIED_ABILITIES],
    [Spells.CatForm, CAT_FORM_IMPLIED_ABILITIES],
  ]),

  auraModifiers: {
    // Bear Form (same modifier as Dire Bear)
    [Spells.BearForm]: () => ({
      source: 'class',
      name: 'Bear Form',

      value: Mods.DireBear,
    }),

    // Dire Bear Form
    [Spells.DireBearForm]: () => ({
      source: 'class',
      name: 'Dire Bear Form',

      value: Mods.DireBear,
    }),

    // Cat Form
    [Spells.CatForm]: () => ({
      source: 'class',
      name: 'Cat Form',

      value: Mods.Cat,
    }),

    // Feral Instinct - additive with Bear/Dire Bear Form threat
    [Spells.FeralInstinctRank1]: (ctx) => ({
      source: 'talent',
      name: 'Feral Instinct (Rank 1)',
      value: feralInstinctMultiplier(1, ctx.sourceAuras),
    }),
    [Spells.FeralInstinctRank2]: (ctx) => ({
      source: 'talent',
      name: 'Feral Instinct (Rank 2)',
      value: feralInstinctMultiplier(2, ctx.sourceAuras),
    }),
    [Spells.FeralInstinctRank3]: (ctx) => ({
      source: 'talent',
      name: 'Feral Instinct (Rank 3)',
      value: feralInstinctMultiplier(3, ctx.sourceAuras),
    }),
    [Spells.FeralInstinctRank4]: (ctx) => ({
      source: 'talent',
      name: 'Feral Instinct (Rank 4)',
      value: feralInstinctMultiplier(4, ctx.sourceAuras),
    }),
    [Spells.FeralInstinctRank5]: (ctx) => ({
      source: 'talent',
      name: 'Feral Instinct (Rank 5)',
      value: feralInstinctMultiplier(5, ctx.sourceAuras),
    }),
  },

  abilities: {
    // Forms - zero threat on stance change
    [Spells.BearForm]: noThreat(),
    [Spells.DireBearForm]: noThreat(),
    [Spells.CatForm]: noThreat(),
    [Spells.MoonkinForm]: noThreat(),

    // Maul - 1.75x damage
    [Spells.MaulR1]: calculateThreat({ modifier: Mods.Maul }),
    [Spells.MaulR2]: calculateThreat({ modifier: Mods.Maul }),
    [Spells.MaulR3]: calculateThreat({ modifier: Mods.Maul }),
    [Spells.MaulR4]: calculateThreat({ modifier: Mods.Maul }),
    [Spells.MaulR5]: calculateThreat({ modifier: Mods.Maul }),
    [Spells.MaulR6]: calculateThreat({ modifier: Mods.Maul }),
    [Spells.MaulR7]: calculateThreat({ modifier: Mods.Maul }),

    // Swipe - 1.75x damage
    [Spells.SwipeR1]: calculateThreat({ modifier: Mods.Swipe }),
    [Spells.SwipeR2]: calculateThreat({ modifier: Mods.Swipe }),
    [Spells.SwipeR3]: calculateThreat({ modifier: Mods.Swipe }),
    [Spells.SwipeR4]: calculateThreat({ modifier: Mods.Swipe }),
    [Spells.SwipeR5]: calculateThreat({ modifier: Mods.Swipe }),

    // Demoralizing Roar - flat threat per rank
    [Spells.DemoRoarR1]: threatOnDebuff(9),
    [Spells.DemoRoarR2]: threatOnDebuff(15),
    [Spells.DemoRoarR3]: threatOnDebuff(20),
    [Spells.DemoRoarR4]: threatOnDebuff(30),
    [Spells.DemoRoarR5]: threatOnDebuff(39),

    // Growl - taunt
    [Spells.Growl]: tauntTarget({ bonus: 0 }),

    // Challenging Roar - fixate state only, no direct threat set
    [Spells.ChallengingRoar]: noThreat(),

    // Bash - zero threat (needs verification)
    [Spells.Bash]: noThreat(),

    // Cower - threat reduction on cast, rollback on miss/immune/resist
    [Spells.CowerR1]: threatOnCastRollbackOnMiss(-240),
    [Spells.CowerR2]: threatOnCastRollbackOnMiss(-390),
    [Spells.CowerR3]: threatOnCastRollbackOnMiss(-600),

    // Faerie Fire (all ranks) - flat 108 threat
    [Spells.FaerieFireFeralR1]: threatOnDebuff(108),
    [Spells.FaerieFireFeralR2]: threatOnDebuff(108),
    [Spells.FaerieFireFeralR3]: threatOnDebuff(108),
    [Spells.FaerieFireFeralR4]: threatOnDebuff(108),
    [Spells.FaerieFireR1]: threatOnDebuff(108),
    [Spells.FaerieFireR2]: threatOnDebuff(108),
    [Spells.FaerieFireR3]: threatOnDebuff(108),
    [Spells.FaerieFireR4]: threatOnDebuff(108),

    // Zero threat abilities
    [Spells.Prowl]: noThreat(),
    [Spells.TigersFury]: noThreat(),
    [Spells.DashR1]: noThreat(),
    [Spells.DashR2]: noThreat(),
    [Spells.Clearcasting]: noThreat(),
    [Spells.Innervate]: noThreat(),
    [Spells.LeaderOfThePack]: noThreat(),
  },

  fixateBuffs: new Set([Spells.Growl, Spells.ChallengingRoar]),

  talentImplications: (ctx: TalentImplicationContext) => {
    const feralInstinctRank = inferFeralInstinctRank(ctx)
    if (feralInstinctRank === 0) {
      return []
    }
    return [FERAL_INSTINCT_AURA_BY_RANK[feralInstinctRank - 1]!]
  },
}
