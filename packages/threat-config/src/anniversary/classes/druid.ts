/**
 * Druid Threat Configuration - Anniversary Edition
 *
 * Spell IDs and threat values are based on Classic/Anniversary Edition mechanics.
 */
import {
  calculateThreat,
  noThreat,
  tauntTarget,
  threatOnDebuff,
} from '../../shared/formulas'
import type { ClassThreatConfig } from '../../types'

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

    // TODO: [Feral Instinct] Talent - can't detect from WCL combatantInfo
    // Would add 0.03 per rank (up to 0.15) additively with Bear Form
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
    [Spells.Growl]: tauntTarget(0),

    // Challenging Roar - taunt
    [Spells.ChallengingRoar]: tauntTarget(0),

    // Bash - zero threat (needs verification)
    [Spells.Bash]: noThreat(),

    // Cower - negative threat
    [Spells.CowerR1]: calculateThreat({ modifier: 0, bonus: -240 }),
    [Spells.CowerR2]: calculateThreat({ modifier: 0, bonus: -390 }),
    [Spells.CowerR3]: calculateThreat({ modifier: 0, bonus: -600 }),

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

    // TODO: [22842] Frenzied Regeneration heals - need modHeal formula
    // TODO: [5229] Enrage - resourcechange handler
    // TODO: [17057] Furor - resourcechange handler
  },

  fixateBuffs: new Set([Spells.Growl, Spells.ChallengingRoar]),
}
