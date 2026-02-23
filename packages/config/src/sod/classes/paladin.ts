/**
 * Paladin Threat Configuration - Season of Discovery
 */
import {
  type AuraModifierFn,
  type ClassThreatConfig,
  SpellSchool,
  type ThreatContext,
} from '@wow-threat/shared'
import type { GearItem } from '@wow-threat/wcl-types'

import {
  Spells as EraSpells,
  paladinConfig as eraPaladinConfig,
  hasRighteousFuryAura,
} from '../../era/classes/paladin'
import { tauntTarget } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  HandOfReckoning: 407631, // https://www.wowhead.com/classic/spell=407631/
  EngraveHandOfReckoning: 410001, // https://www.wowhead.com/classic/spell=410001/
  RighteousFurySoD: 407627, // SoD override | https://www.wowhead.com/classic/spell=407627/
} as const

const Runes = {
  HandOfReckoning: 6844,
} as const

/**
 * From the Light Club disc:
 * - Hand of Reckoning rune applies a 1.5 baseline tank threat multiplier to all threat
 * - Holy threat without imp. RF with HoR is 2.23 (1.6 * 1.5 is 2.4 so it's not applied consitently)
 * - Holy threat with imp. RF and HoR is 2.85 (= 1.9 * 1.5)
 */
const Mods = {
  RighteousFury: 1.6,
  /** While RF is up, increases the base from 1.6 to 1.8 */
  HandOfReckoning: 1.5,

  VengeanceR1: -0.06,
  VengeanceR2: -0.12,
  VengeanceR3: -0.18,
  VengeanceR4: -0.24,
  VengeanceR5: -0.3,
} as const

const RIGHTEOUS_FURY_AURA_IDS = [Spells.RighteousFurySoD] as const

function buildImprovedRighteousFuryModifier(
  multiplier: number,
  name: string,
): AuraModifierFn {
  return (ctx: ThreatContext) => ({
    source: 'talent',
    name,
    value: hasRighteousFuryAura(ctx.sourceAuras, RIGHTEOUS_FURY_AURA_IDS)
      ? multiplier
      : 1,
    schoolMask: SpellSchool.Holy,
  })
}

function inferGearAuras(gear: GearItem[]): number[] {
  const inheritedAuras = eraPaladinConfig.gearImplications?.(gear) ?? []
  const inferredAuras = new Set<number>(inheritedAuras)

  if (gear.some((item) => item.temporaryEnchant === Runes.HandOfReckoning)) {
    inferredAuras.add(Spells.EngraveHandOfReckoning)
  }

  return [...inferredAuras]
}

export const paladinConfig: ClassThreatConfig = {
  ...eraPaladinConfig,

  auraModifiers: {
    ...eraPaladinConfig.auraModifiers,
    [Spells.RighteousFurySoD]: () => ({
      source: 'buff',
      name: 'Righteous Fury',
      value: Mods.RighteousFury,
      schoolMask: SpellSchool.Holy,
    }),
    [Spells.ImprovedRighteousFuryR1]: buildImprovedRighteousFuryModifier(
      1.696 / 1.6,
      'Improved Righteous Fury (Rank 1)',
    ),
    [Spells.ImprovedRighteousFuryR2]: buildImprovedRighteousFuryModifier(
      1.798 / 1.6,
      'Improved Righteous Fury (Rank 2)',
    ),
    [Spells.ImprovedRighteousFuryR3]: buildImprovedRighteousFuryModifier(
      1.9 / 1.6,
      'Improved Righteous Fury (Rank 3)',
    ),
    [Spells.EngraveHandOfReckoning]: (ctx) => ({
      source: 'gear',
      name: 'Engrave Gloves - Hand of Reckoning',
      value: ctx.sourceAuras.has(Spells.RighteousFurySoD)
        ? Mods.HandOfReckoning
        : 1,
    }),
    [Spells.VengeanceR1]: (ctx) => ({
      source: 'talent',
      name: 'Vengeance (Rank 1)',
      value: ctx.sourceAuras.has(Spells.RighteousFurySoD)
        ? 1
        : 1 + Mods.VengeanceR1,
    }),

    [Spells.VengeanceR2]: (ctx) => ({
      source: 'talent',
      name: 'Vengeance (Rank 2)',
      value: ctx.sourceAuras.has(Spells.RighteousFurySoD)
        ? 1
        : 1 + Mods.VengeanceR2,
    }),
    [Spells.VengeanceR3]: (ctx) => ({
      source: 'talent',
      name: 'Vengeance (Rank 3)',
      value: ctx.sourceAuras.has(Spells.RighteousFurySoD)
        ? 1
        : 1 + Mods.VengeanceR3,
    }),
    [Spells.VengeanceR4]: (ctx) => ({
      source: 'talent',
      name: 'Vengeance (Rank 4)',
      value: ctx.sourceAuras.has(Spells.RighteousFurySoD)
        ? 1
        : 1 + Mods.VengeanceR4,
    }),
    [Spells.VengeanceR5]: (ctx) => ({
      source: 'talent',
      name: 'Vengeance (Rank 5)',
      value: ctx.sourceAuras.has(Spells.RighteousFurySoD)
        ? 1
        : 1 + Mods.VengeanceR5,
    }),
  },

  abilities: {
    ...eraPaladinConfig.abilities,
    [Spells.HandOfReckoning]: tauntTarget({ bonus: 0, eventTypes: ['cast'] }),
  },

  auraImplications: eraPaladinConfig.auraImplications,
  talentImplications: eraPaladinConfig.talentImplications,

  fixateBuffs: new Set([
    ...(eraPaladinConfig.fixateBuffs ?? []),
    Spells.HandOfReckoning,
  ]),
  gearImplications: inferGearAuras,
}
