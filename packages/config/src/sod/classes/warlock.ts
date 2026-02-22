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
  Menace: 403828,
  DemonicHowl: 412789,
} as const

export const Buffs = {
  Metamorphosis: 403789,
  MasterDemonologistR1: 23785,
  MasterDemonologistR2: 23822,
  MasterDemonologistR3: 23823,
  MasterDemonologistR4: 23824,
  MasterDemonologistR5: 23825,
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
  const impliedAbilities = new Set(mergedMap.get(Buffs.Metamorphosis) ?? [])
  impliedAbilities.add(Spells.Menace)
  impliedAbilities.add(Spells.DemonicHowl)
  mergedMap.set(Buffs.Metamorphosis, impliedAbilities)
  return mergedMap
}

export const warlockConfig: ClassThreatConfig = {
  ...eraWarlockConfig,

  auraModifiers: {
    ...eraWarlockConfig.auraModifiers,
    [Buffs.Metamorphosis]: () => ({
      source: 'aura',
      name: 'Metamorphosis',
      value: Mods.Metamorphosis,
    }),
    [Buffs.MasterDemonologistR1]: (ctx) => ({
      source: 'aura',
      name: 'Master Demonologist (Rank 1)',
      value: !ctx.sourceAuras.has(Spells.ImpActive)
        ? 1
        : ctx.sourceAuras.has(Buffs.Metamorphosis)
          ? Mods.MasterDemonologist
          : -Mods.MasterDemonologist,
    }),
    [Buffs.MasterDemonologistR2]: (ctx) => ({
      source: 'aura',
      name: 'Master Demonologist (Rank 2)',
      value: !ctx.sourceAuras.has(Spells.ImpActive)
        ? 1
        : ctx.sourceAuras.has(Buffs.Metamorphosis)
          ? Mods.MasterDemonologist * 2
          : -Mods.MasterDemonologist * 2,
    }),
    [Buffs.MasterDemonologistR3]: (ctx) => ({
      source: 'aura',
      name: 'Master Demonologist (Rank 3)',
      value: !ctx.sourceAuras.has(Spells.ImpActive)
        ? 1
        : ctx.sourceAuras.has(Buffs.Metamorphosis)
          ? Mods.MasterDemonologist * 3
          : -Mods.MasterDemonologist * 3,
    }),
    [Buffs.MasterDemonologistR4]: (ctx) => ({
      source: 'aura',
      name: 'Master Demonologist (Rank 4)',
      value: !ctx.sourceAuras.has(Spells.ImpActive)
        ? 1
        : ctx.sourceAuras.has(Buffs.Metamorphosis)
          ? Mods.MasterDemonologist * 4
          : -Mods.MasterDemonologist * 4,
    }),
    [Buffs.MasterDemonologistR5]: (ctx) => ({
      source: 'aura',
      name: 'Master Demonologist (Rank 5)',
      value: !ctx.sourceAuras.has(Spells.ImpActive)
        ? 1
        : ctx.sourceAuras.has(Buffs.Metamorphosis)
          ? Mods.MasterDemonologist * 5
          : -Mods.MasterDemonologist * 5,
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
