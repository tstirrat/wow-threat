/**
 * Warlock Threat Configuration - Anniversary Edition
 *
 * Searing Pain has 2x threat. Curses generate threat on application.
 */
import type { ClassThreatConfig } from '@wow-threat/shared'

import {
  noThreat,
  threat,
  threatOnDebuff,
  threatOnDebuffOrDamage,
} from '../../shared/formulas'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  // Synthetic aura inferred from summon/pet spell evidence
  ImpActive: 910210, // https://www.wowhead.com/classic/spell=910210/

  // Pet summon/ability signals
  SummonImp: 688, // https://www.wowhead.com/classic/spell=688/summon-imp
  FireboltR1: 3110, // https://www.wowhead.com/classic/spell=3110/firebolt
  FireboltR2: 7799, // https://www.wowhead.com/classic/spell=7799/firebolt
  FireboltR3: 7800, // https://www.wowhead.com/classic/spell=7800/firebolt
  FireboltR4: 7801, // https://www.wowhead.com/classic/spell=7801/firebolt
  FireboltR5: 7802, // https://www.wowhead.com/classic/spell=7802/firebolt
  FireboltR6: 11762, // https://www.wowhead.com/classic/spell=11762/firebolt
  FireboltR7: 11763, // https://www.wowhead.com/classic/spell=11763/firebolt
  FireboltR8: 27267, // https://www.wowhead.com/classic/spell=27267/firebolt

  // Searing Pain - 2x threat
  SearingPainR1: 5676, // https://www.wowhead.com/classic/spell=5676/
  SearingPainR2: 17919, // https://www.wowhead.com/classic/spell=17919/
  SearingPainR3: 17920, // https://www.wowhead.com/classic/spell=17920/
  SearingPainR4: 17921, // https://www.wowhead.com/classic/spell=17921/
  SearingPainR5: 17922, // https://www.wowhead.com/classic/spell=17922/
  SearingPainR6: 17923, // https://www.wowhead.com/classic/spell=17923/

  // Curses
  CurseOfRecklessnessR1: 704, // https://www.wowhead.com/classic/spell=704/
  CurseOfRecklessnessR2: 7658, // https://www.wowhead.com/classic/spell=7658/
  CurseOfRecklessnessR3: 7659, // https://www.wowhead.com/classic/spell=7659/
  CurseOfRecklessnessR4: 11717, // https://www.wowhead.com/classic/spell=11717/
  CurseOfTonguesR1: 1714, // https://www.wowhead.com/classic/spell=1714/
  CurseOfTonguesR2: 11719, // https://www.wowhead.com/classic/spell=11719/
  CurseOfWeaknessR1: 702, // https://www.wowhead.com/classic/spell=702/
  CurseOfWeaknessR2: 1108, // https://www.wowhead.com/classic/spell=1108/
  CurseOfWeaknessR3: 6205, // https://www.wowhead.com/classic/spell=6205/
  CurseOfWeaknessR4: 7646, // https://www.wowhead.com/classic/spell=7646/
  CurseOfWeaknessR5: 11707, // https://www.wowhead.com/classic/spell=11707/
  CurseOfWeaknessR6: 11708, // https://www.wowhead.com/classic/spell=11708/
  CurseOfTheElementsR1: 1490, // https://www.wowhead.com/classic/spell=1490/
  CurseOfTheElementsR2: 11721, // https://www.wowhead.com/classic/spell=11721/
  CurseOfTheElementsR3: 11722, // https://www.wowhead.com/classic/spell=11722/
  CurseOfShadowR1: 17862, // https://www.wowhead.com/classic/spell=17862/
  CurseOfShadowR2: 17937, // https://www.wowhead.com/classic/spell=17937/
  CurseOfExhaustion: 18223, // https://www.wowhead.com/classic/spell=18223/
  CurseOfDoom: 603, // https://www.wowhead.com/classic/spell=603/
  AmCurse: 18288, // https://www.wowhead.com/classic/spell=18288/

  // Fear
  FearR1: 5782, // https://www.wowhead.com/classic/spell=5782/
  FearR2: 6213, // https://www.wowhead.com/classic/spell=6213/
  FearR3: 6215, // https://www.wowhead.com/classic/spell=6215/
  HowlOfTerrorR1: 5484, // https://www.wowhead.com/classic/spell=5484/
  HowlOfTerrorR2: 17928, // https://www.wowhead.com/classic/spell=17928/

  // Banish
  BanishR1: 710, // https://www.wowhead.com/classic/spell=710/
  BanishR2: 18647, // https://www.wowhead.com/classic/spell=18647/

  // Siphon Life
  SiphonLifeR1: 18265, // https://www.wowhead.com/classic/spell=18265/
  SiphonLifeR2: 18879, // https://www.wowhead.com/classic/spell=18879/
  SiphonLifeR3: 18880, // https://www.wowhead.com/classic/spell=18880/
  SiphonLifeR4: 18881, // https://www.wowhead.com/classic/spell=18881/

  // Life Tap - zero threat
  LifeTapR1: 1454, // https://www.wowhead.com/classic/spell=1454/
  LifeTapR2: 1455, // https://www.wowhead.com/classic/spell=1455/
  LifeTapR3: 1456, // https://www.wowhead.com/classic/spell=1456/
  LifeTapR4: 11687, // https://www.wowhead.com/classic/spell=11687/
  LifeTapR5: 11688, // https://www.wowhead.com/classic/spell=11688/
  LifeTapR6: 11689, // https://www.wowhead.com/classic/spell=11689/
  LifeTapScript: 31818, // https://www.wowhead.com/classic/spell=31818/

  // Drain Mana - zero threat
  DrainManaR1: 5138, // https://www.wowhead.com/classic/spell=5138/
  DrainManaR2: 6226, // https://www.wowhead.com/classic/spell=6226/
  DrainManaR3: 11703, // https://www.wowhead.com/classic/spell=11703/
  DrainManaR4: 11704, // https://www.wowhead.com/classic/spell=11704/

  MasterDemonologistR1: 23759, // https://www.wowhead.com/classic/spell=23759/
  MasterDemonologistR2: 23826, // https://www.wowhead.com/classic/spell=23826/
  MasterDemonologistR3: 23827, // https://www.wowhead.com/classic/spell=23827/
  MasterDemonologistR4: 23828, // https://www.wowhead.com/classic/spell=23828/
  MasterDemonologistR5: 23829, // https://www.wowhead.com/classic/spell=23829/
} as const

// ============================================================================
// Modifiers
// ============================================================================

export const Mods = {
  SearingPain: 2.0,
  MasterDemonologist: 0.04,
}

// ============================================================================
// Configuration
// ============================================================================

export const warlockConfig: ClassThreatConfig = {
  petAuraImplications: new Map([
    [
      Spells.ImpActive,
      new Set([
        Spells.SummonImp,
        Spells.FireboltR1,
        Spells.FireboltR2,
        Spells.FireboltR3,
        Spells.FireboltR4,
        Spells.FireboltR5,
        Spells.FireboltR6,
        Spells.FireboltR7,
        Spells.FireboltR8,
      ]),
    ],
  ]),

  auraModifiers: {
    [Spells.MasterDemonologistR1]: (ctx) => ({
      source: 'talent',
      name: 'Master Demonologist (Rank 1)',
      value: ctx.sourceAuras.has(Spells.ImpActive)
        ? 1 - Mods.MasterDemonologist
        : 1,
    }),
    [Spells.MasterDemonologistR2]: (ctx) => ({
      source: 'talent',
      name: 'Master Demonologist (Rank 2)',
      value: ctx.sourceAuras.has(Spells.ImpActive)
        ? 1 - Mods.MasterDemonologist * 2
        : 1,
    }),
    [Spells.MasterDemonologistR3]: (ctx) => ({
      source: 'talent',
      name: 'Master Demonologist (Rank 3)',
      value: ctx.sourceAuras.has(Spells.ImpActive)
        ? 1 - Mods.MasterDemonologist * 3
        : 1,
    }),
    [Spells.MasterDemonologistR4]: (ctx) => ({
      source: 'talent',
      name: 'Master Demonologist (Rank 4)',
      value: ctx.sourceAuras.has(Spells.ImpActive)
        ? 1 - Mods.MasterDemonologist * 4
        : 1,
    }),
    [Spells.MasterDemonologistR5]: (ctx) => ({
      source: 'talent',
      name: 'Master Demonologist (Rank 5)',
      value: ctx.sourceAuras.has(Spells.ImpActive)
        ? 1 - Mods.MasterDemonologist * 5
        : 1,
    }),
  },

  abilities: {
    // Searing Pain - 2x threat
    [Spells.SearingPainR1]: threat({ modifier: Mods.SearingPain }),
    [Spells.SearingPainR2]: threat({ modifier: Mods.SearingPain }),
    [Spells.SearingPainR3]: threat({ modifier: Mods.SearingPain }),
    [Spells.SearingPainR4]: threat({ modifier: Mods.SearingPain }),
    [Spells.SearingPainR5]: threat({ modifier: Mods.SearingPain }),
    [Spells.SearingPainR6]: threat({ modifier: Mods.SearingPain }),

    // Curses - 2x mana cost as threat
    [Spells.CurseOfRecklessnessR1]: threatOnDebuff(2 * 14),
    [Spells.CurseOfRecklessnessR2]: threatOnDebuff(2 * 28),
    [Spells.CurseOfRecklessnessR3]: threatOnDebuff(2 * 42),
    [Spells.CurseOfRecklessnessR4]: threatOnDebuff(2 * 56),
    [Spells.CurseOfTonguesR1]: threatOnDebuff(2 * 26),
    [Spells.CurseOfTonguesR2]: threatOnDebuff(2 * 50),
    [Spells.CurseOfWeaknessR1]: threatOnDebuff(2 * 4),
    [Spells.CurseOfWeaknessR2]: threatOnDebuff(2 * 12),
    [Spells.CurseOfWeaknessR3]: threatOnDebuff(2 * 22),
    [Spells.CurseOfWeaknessR4]: threatOnDebuff(2 * 32),
    [Spells.CurseOfWeaknessR5]: threatOnDebuff(2 * 42),
    [Spells.CurseOfWeaknessR6]: threatOnDebuff(2 * 52),
    [Spells.CurseOfTheElementsR1]: threatOnDebuff(2 * 32),
    [Spells.CurseOfTheElementsR2]: threatOnDebuff(2 * 46),
    [Spells.CurseOfTheElementsR3]: threatOnDebuff(2 * 60),
    [Spells.CurseOfShadowR1]: threatOnDebuff(2 * 44),
    [Spells.CurseOfShadowR2]: threatOnDebuff(2 * 56),
    [Spells.CurseOfExhaustion]: noThreat(),
    [Spells.CurseOfDoom]: threatOnDebuffOrDamage(120),
    [Spells.AmCurse]: noThreat(),

    // Fear - threat on debuff
    [Spells.FearR1]: threatOnDebuff(2 * 8),
    [Spells.FearR2]: threatOnDebuff(2 * 32),
    [Spells.FearR3]: threatOnDebuff(2 * 56),
    [Spells.HowlOfTerrorR1]: threatOnDebuff(2 * 40),
    [Spells.HowlOfTerrorR2]: threatOnDebuff(2 * 54),

    // Banish - threat on debuff
    [Spells.BanishR1]: threatOnDebuff(2 * 28),
    [Spells.BanishR2]: threatOnDebuff(2 * 48),

    // Siphon Life - threat on debuff apply + periodic damage threat
    [Spells.SiphonLifeR1]: threatOnDebuffOrDamage(2 * 30),
    [Spells.SiphonLifeR2]: threatOnDebuffOrDamage(2 * 38),
    [Spells.SiphonLifeR3]: threatOnDebuffOrDamage(2 * 48),
    [Spells.SiphonLifeR4]: threatOnDebuffOrDamage(2 * 58),

    // Life Tap - zero threat
    [Spells.LifeTapR1]: noThreat(),
    [Spells.LifeTapR2]: noThreat(),
    [Spells.LifeTapR3]: noThreat(),
    [Spells.LifeTapR4]: noThreat(),
    [Spells.LifeTapR5]: noThreat(),
    [Spells.LifeTapR6]: noThreat(),
    [Spells.LifeTapScript]: noThreat(),

    // Drain Mana - zero threat
    [Spells.DrainManaR1]: noThreat(),
    [Spells.DrainManaR2]: noThreat(),
    [Spells.DrainManaR3]: noThreat(),
    [Spells.DrainManaR4]: noThreat(),
  },
}
