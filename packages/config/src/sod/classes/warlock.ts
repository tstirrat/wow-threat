/**
 * Warlock Threat Configuration - Season of Discovery
 */
import type { ClassThreatConfig } from '@wow-threat/shared'

import {
  Spells as EraSpells,
  warlockConfig as eraWarlockConfig,
} from '../../era/classes/warlock'
import { tauntTarget } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  Menace: 403828, // https://www.wowhead.com/classic/spell=403828/
  DemonicHowl: 412789, // https://www.wowhead.com/classic/spell=412789/
  Metamorphosis: 403789, // https://www.wowhead.com/classic/spell=403789/
} as const

const Mods = {
  Metamorphosis: 1.77,
  /**
   * Up to 20% more threat if imp and metamorphosis are active.
   * Without Metamorphosis, acts as a threat reduction.
   */
  MasterDemonologist: 0.04,
} as const

function buildAuraImplications(): Map<number, ReadonlySet<number>> | undefined {
  const baseMap = eraWarlockConfig.auraImplications
  const mergedMap = new Map<number, ReadonlySet<number>>(baseMap ?? [])
  const impliedAbilities = new Set(mergedMap.get(Spells.Metamorphosis) ?? [])
  impliedAbilities.add(Spells.Menace)
  impliedAbilities.add(Spells.DemonicHowl)
  mergedMap.set(Spells.Metamorphosis, impliedAbilities)
  return mergedMap
}

export const warlockConfig: ClassThreatConfig = {
  ...eraWarlockConfig,

  auraModifiers: {
    ...eraWarlockConfig.auraModifiers,
    [Spells.Metamorphosis]: () => ({
      source: 'aura',
      name: 'Metamorphosis',
      value: Mods.Metamorphosis,
    }),
    [Spells.MasterDemonologistR1]: (ctx) => ({
      source: 'aura',
      name: 'Master Demonologist (Rank 1)',
      value: ctx.sourceAuras.has(Spells.Metamorphosis)
        ? 1 + Mods.MasterDemonologist
        : 1 - Mods.MasterDemonologist,
    }),
    [Spells.MasterDemonologistR2]: (ctx) => ({
      source: 'aura',
      name: 'Master Demonologist (Rank 2)',
      value: ctx.sourceAuras.has(Spells.Metamorphosis)
        ? 1 + Mods.MasterDemonologist * 2
        : 1 - Mods.MasterDemonologist * 2,
    }),
    [Spells.MasterDemonologistR3]: (ctx) => ({
      source: 'aura',
      name: 'Master Demonologist (Rank 3)',
      value: ctx.sourceAuras.has(Spells.Metamorphosis)
        ? 1 + Mods.MasterDemonologist * 3
        : 1 - Mods.MasterDemonologist * 3,
    }),
    [Spells.MasterDemonologistR4]: (ctx) => ({
      source: 'aura',
      name: 'Master Demonologist (Rank 4)',
      value: ctx.sourceAuras.has(Spells.Metamorphosis)
        ? 1 + Mods.MasterDemonologist * 4
        : 1 - Mods.MasterDemonologist * 4,
    }),
    [Spells.MasterDemonologistR5]: (ctx) => ({
      source: 'aura',
      name: 'Master Demonologist (Rank 5)',
      value: ctx.sourceAuras.has(Spells.Metamorphosis)
        ? 1 + Mods.MasterDemonologist * 5
        : 1 - Mods.MasterDemonologist * 5,
    }),
  },

  abilities: {
    ...eraWarlockConfig.abilities,
    [Spells.Menace]: tauntTarget({ eventTypes: ['cast'] }),
  },

  fixateBuffs: new Set([
    ...(eraWarlockConfig.fixateBuffs ?? []),
    Spells.Menace,
    Spells.DemonicHowl,
  ]),
  auraImplications: buildAuraImplications(),
}
