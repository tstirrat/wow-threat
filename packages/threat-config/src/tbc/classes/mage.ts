/**
 * Anniversary mage deltas over Era.
 *
 * Applies TBC talent coefficients and threat-drop behavior.
 */
import type { ClassThreatConfig } from '@wcl-threat/shared'
import { SpellSchool } from '@wcl-threat/shared'

import {
  Spells as EraSpells,
  mageConfig as eraMageConfig,
} from '../../era/classes/mage'
import { modifyThreat } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  Invisibility: 66,
} as const

export const mageConfig: ClassThreatConfig = {
  ...eraMageConfig,

  auraModifiers: {
    ...eraMageConfig.auraModifiers,

    [Spells.BurningSoulRank1]: () => ({
      source: 'talent',
      name: 'Burning Soul (Rank 1)',
      value: 0.95,
      schoolMask: SpellSchool.Fire,
    }),
    [Spells.BurningSoulRank2]: () => ({
      source: 'talent',
      name: 'Burning Soul (Rank 2)',
      value: 0.9,
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
