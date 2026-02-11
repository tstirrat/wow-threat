/**
 * Warlock Threat Configuration - Anniversary Edition
 *
 * Searing Pain has 2x threat. Curses generate threat on application.
 */
import type { ClassThreatConfig } from '@wcl-threat/shared'

import {
  calculateThreat,
  noThreat,
  threatOnDebuff,
  threatOnDebuffOrDamage,
} from '../../shared/formulas'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  // Searing Pain - 2x threat
  SearingPainR1: 5676,
  SearingPainR2: 17919,
  SearingPainR3: 17920,
  SearingPainR4: 17921,
  SearingPainR5: 17922,
  SearingPainR6: 17923,

  // Curses
  CurseOfRecklessnessR1: 704,
  CurseOfRecklessnessR2: 7658,
  CurseOfRecklessnessR3: 7659,
  CurseOfRecklessnessR4: 11717,
  CurseOfTonguesR1: 1714,
  CurseOfTonguesR2: 11719,
  CurseOfWeaknessR1: 702,
  CurseOfWeaknessR2: 1108,
  CurseOfWeaknessR3: 6205,
  CurseOfWeaknessR4: 7646,
  CurseOfWeaknessR5: 11707,
  CurseOfWeaknessR6: 11708,
  CurseOfTheElementsR1: 1490,
  CurseOfTheElementsR2: 11721,
  CurseOfTheElementsR3: 11722,
  CurseOfShadowR1: 17862,
  CurseOfShadowR2: 17937,
  CurseOfExhaustion: 18223,
  CurseOfDoom: 603,
  AmCurse: 18288,

  // Fear
  FearR1: 5782,
  FearR2: 6213,
  FearR3: 6215,
  HowlOfTerrorR1: 5484,
  HowlOfTerrorR2: 17928,

  // Banish
  BanishR1: 710,
  BanishR2: 18647,

  // Siphon Life
  SiphonLifeR1: 18265,
  SiphonLifeR2: 18879,
  SiphonLifeR3: 18880,
  SiphonLifeR4: 18881,

  // Life Tap - zero threat
  LifeTapR1: 1454,
  LifeTapR2: 1455,
  LifeTapR3: 1456,
  LifeTapR4: 11687,
  LifeTapR5: 11688,
  LifeTapR6: 11689,
  LifeTapScript: 31818,

  // Drain Mana - zero threat
  DrainManaR1: 5138,
  DrainManaR2: 6226,
  DrainManaR3: 11703,
  DrainManaR4: 11704,
} as const

// ============================================================================
// Modifiers
// ============================================================================

const Mods = {
  SearingPain: 2.0,
}

// ============================================================================
// Configuration
// ============================================================================

export const warlockConfig: ClassThreatConfig = {
  auraModifiers: {},

  abilities: {
    // Searing Pain - 2x threat
    [Spells.SearingPainR1]: calculateThreat({ modifier: Mods.SearingPain }),
    [Spells.SearingPainR2]: calculateThreat({ modifier: Mods.SearingPain }),
    [Spells.SearingPainR3]: calculateThreat({ modifier: Mods.SearingPain }),
    [Spells.SearingPainR4]: calculateThreat({ modifier: Mods.SearingPain }),
    [Spells.SearingPainR5]: calculateThreat({ modifier: Mods.SearingPain }),
    [Spells.SearingPainR6]: calculateThreat({ modifier: Mods.SearingPain }),

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
