/**
 * Anniversary mage deltas over Era.
 *
 * Applies TBC talent coefficients and threat-drop behavior.
 */
import type { ClassThreatConfig } from '@wow-threat/shared'
import { SpellSchool } from '@wow-threat/shared'

import {
  Mods as EraMods,
  Spells as EraSpells,
  mageConfig as eraMageConfig,
} from '../../era/classes/mage'
import { modifyThreat } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  Invisibility: 66, // https://www.wowhead.com/tbc/spell=66/
} as const

export const Mods = {
  ...EraMods,
} as const

export const mageConfig: ClassThreatConfig = {
  ...eraMageConfig,

  auraModifiers: {
    ...eraMageConfig.auraModifiers,

    [Spells.BurningSoulRank1]: () => ({
      source: 'talent',
      name: 'Burning Soul (Rank 1)',
      value: 1 - Mods.BurningSoul,
      schoolMask: SpellSchool.Fire,
    }),
    [Spells.BurningSoulRank2]: () => ({
      source: 'talent',
      name: 'Burning Soul (Rank 2)',
      value: 1 - Mods.BurningSoul * 2,
      schoolMask: SpellSchool.Fire,
    }),

    [Spells.FrostChannelingRank1]: () => ({
      source: 'talent',
      name: 'Frost Channeling (Rank 1)',
      value: 0.966667,
      schoolMask: SpellSchool.Frost,
    }),
    [Spells.FrostChannelingRank2]: () => ({
      source: 'talent',
      name: 'Frost Channeling (Rank 2)',
      value: 0.933333,
      schoolMask: SpellSchool.Frost,
    }),
    [Spells.FrostChannelingRank3]: () => ({
      source: 'talent',
      name: 'Frost Channeling (Rank 3)',
      value: 0.9,
      schoolMask: SpellSchool.Frost,
    }),
  },

  abilities: {
    ...eraMageConfig.abilities,
    [Spells.Invisibility]: modifyThreat({
      modifier: 0.8,
      target: 'all',
      eventTypes: ['applybuff'],
    }),
  },
}
