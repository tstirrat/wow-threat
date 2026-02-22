/**
 * Druid Threat Configuration - Season of Discovery
 */
import type { ClassThreatConfig } from '@wow-threat/shared'
import { SpellSchool } from '@wow-threat/shared'

import {
  Spells as EraSpells,
  druidConfig as eraDruidConfig,
} from '../../era/classes/druid'
import { threat } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  T1_Tank_6pc: 456332, // https://www.wowhead.com/classic/spell=456332/
  Starsurge: 417157, // https://www.wowhead.com/classic/spell=417157/
  Starfall: 439753, // https://www.wowhead.com/classic/spell=439753/
  LacerateInitial: 414644, // https://www.wowhead.com/classic/spell=414644/
  LacerateDot: 414647, // https://www.wowhead.com/classic/spell=414647/
} as const

const Mods = {
  Moonkin: 0.7,
  Swipe: 3.5,
  Lacerate: 3.5,
  // +0.2 additive over Dire Bear's 1.3 baseline.
  T1_Tank_6pc_BearFormBonus: (1.3 + 0.2) / 1.3,
} as const

function buildAuraImplications(): Map<number, ReadonlySet<number>> | undefined {
  const baseMap = eraDruidConfig.auraImplications
  const mergedMap = new Map<number, ReadonlySet<number>>(baseMap ?? [])
  const moonkinAbilities = new Set(mergedMap.get(EraSpells.MoonkinForm) ?? [])
  moonkinAbilities.add(Spells.Starsurge)
  moonkinAbilities.add(Spells.Starfall)
  mergedMap.set(EraSpells.MoonkinForm, moonkinAbilities)
  return mergedMap
}

export const druidConfig: ClassThreatConfig = {
  ...eraDruidConfig,

  auraModifiers: {
    ...eraDruidConfig.auraModifiers,
    [EraSpells.MoonkinForm]: () => ({
      source: 'class',
      name: 'Moonkin Form',
      value: Mods.Moonkin,
      schoolMask: SpellSchool.Arcane | SpellSchool.Nature,
    }),
    [Spells.T1_Tank_6pc]: (ctx) => ({
      source: 'gear',
      name: 'S03 T1 Druid Tank 6pc',
      value:
        ctx.sourceAuras.has(EraSpells.BearForm) ||
        ctx.sourceAuras.has(EraSpells.DireBearForm)
          ? Mods.T1_Tank_6pc_BearFormBonus
          : 1,
    }),
  },

  abilities: {
    ...eraDruidConfig.abilities,
    [EraSpells.SwipeR1]: threat({ modifier: Mods.Swipe }),
    [EraSpells.SwipeR2]: threat({ modifier: Mods.Swipe }),
    [EraSpells.SwipeR3]: threat({ modifier: Mods.Swipe }),
    [EraSpells.SwipeR4]: threat({ modifier: Mods.Swipe }),
    [EraSpells.SwipeR5]: threat({ modifier: Mods.Swipe }),
    [Spells.LacerateInitial]: threat({ modifier: Mods.Lacerate }),
    [Spells.LacerateDot]: threat({ modifier: Mods.Lacerate }),
  },

  auraImplications: buildAuraImplications(),
}
