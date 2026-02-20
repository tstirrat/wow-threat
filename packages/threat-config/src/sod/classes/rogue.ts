/**
 * Rogue Threat Configuration - Season of Discovery
 */
import type { ClassThreatConfig } from '@wow-threat/shared'

import {
  Spells as EraSpells,
  rogueConfig as eraRogueConfig,
} from '../../era/classes/rogue'
import { tauntTarget, threat } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  SinisterStrikeR7: 11293,
  SinisterStrikeR8: 11294,
  PoisonedKnife: 425012,
  CrimsonTempest: 412096,
  Blunderbuss: 436564,
  FanOfKnives: 409240,
  Tease: 410412,
  UnfairAdvantage: 432274,
  MainGauche: 424919,
  JustAFleshWound: 400014,
  MainGaucheBuff: 462752,
  BladeDance: 400012,
  T1_Tank_2pc: 457349,
} as const

const Mods = {
  JustAFleshWound: 1.855,
  MainGauche: 1.51,
  T1_Tank_2pc: 2,
  UnfairAdvantage: 1.5,
} as const

const MAIN_GAUCHE_SPELL_IDS = new Set<number>([
  Spells.SinisterStrikeR7,
  Spells.SinisterStrikeR8,
  Spells.PoisonedKnife,
])

const T1_TANK_2PC_SPELL_IDS = new Set<number>([
  Spells.CrimsonTempest,
  Spells.Blunderbuss,
  Spells.FanOfKnives,
])

function buildAuraImplications(): Map<number, ReadonlySet<number>> | undefined {
  const baseMap = eraRogueConfig.auraImplications
  const mergedMap = new Map<number, ReadonlySet<number>>(baseMap ?? [])
  const impliedAbilities = new Set(mergedMap.get(Spells.JustAFleshWound) ?? [])
  impliedAbilities.add(Spells.MainGauche)
  mergedMap.set(Spells.JustAFleshWound, impliedAbilities)
  return mergedMap
}

export const rogueConfig: ClassThreatConfig = {
  ...eraRogueConfig,

  auraModifiers: {
    ...eraRogueConfig.auraModifiers,
    [Spells.JustAFleshWound]: () => ({
      source: 'aura',
      name: 'Just a Flesh Wound',
      value: Mods.JustAFleshWound,
    }),
    [Spells.MainGaucheBuff]: () => ({
      source: 'aura',
      name: 'Main Gauche',
      spellIds: MAIN_GAUCHE_SPELL_IDS,
      value: Mods.MainGauche,
    }),
    [Spells.T1_Tank_2pc]: (ctx) => ({
      source: 'gear',
      name: 'S03 - T1 - Rogue - Tank 2pc',
      spellIds: T1_TANK_2PC_SPELL_IDS,
      value:
        ctx.sourceAuras.has(Spells.BladeDance) &&
        ctx.sourceAuras.has(Spells.JustAFleshWound)
          ? Mods.T1_Tank_2pc
          : 1,
    }),
  },

  abilities: {
    ...eraRogueConfig.abilities,
    [Spells.Tease]: tauntTarget({ bonus: 0, eventTypes: ['cast'] }),
    [Spells.UnfairAdvantage]: threat({
      modifier: Mods.UnfairAdvantage,
    }),
  },

  fixateBuffs: new Set([...(eraRogueConfig.fixateBuffs ?? []), Spells.Tease]),
  auraImplications: buildAuraImplications(),
}
