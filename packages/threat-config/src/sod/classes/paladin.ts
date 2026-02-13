/**
 * Paladin Threat Configuration - Season of Discovery
 */
import type { ClassThreatConfig } from '@wcl-threat/shared'
import type { GearItem } from '@wcl-threat/wcl-types'

import {
  Spells as EraSpells,
  paladinConfig as eraPaladinConfig,
} from '../../era/classes/paladin'
import { tauntTarget } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  HandOfReckoning: 407631,
  EngraveHandOfReckoning: 410001,
  RighteousFury: 407627, // SoD override
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
} as const

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
    [Spells.RighteousFury]: () => ({
      source: 'buff',
      name: 'Righteous Fury',
      value: Mods.RighteousFury,
    }),
    [Spells.EngraveHandOfReckoning]: (ctx) => ({
      source: 'gear',
      name: 'Engrave Gloves - Hand of Reckoning',
      value: ctx.sourceAuras.has(Spells.RighteousFury)
        ? Mods.HandOfReckoning
        : 1,
    }),
    // TODO: Vengeance
    // TODO: Improved RF
  },

  abilities: {
    ...eraPaladinConfig.abilities,
    [Spells.HandOfReckoning]: tauntTarget({ bonus: 0, eventTypes: ['cast'] }),
  },

  fixateBuffs: new Set([
    ...(eraPaladinConfig.fixateBuffs ?? []),
    Spells.HandOfReckoning,
  ]),
  gearImplications: inferGearAuras,
}
