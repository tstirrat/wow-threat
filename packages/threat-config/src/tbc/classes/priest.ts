/**
 * Anniversary priest deltas over Era.
 *
 * TBC removes bonus threat from Mind Blast and adjusts Shadow Affinity ranks.
 */
import type { ClassThreatConfig } from '@wcl-threat/shared'
import { SpellSchool } from '@wcl-threat/shared'

import {
  Spells as EraSpells,
  priestConfig as eraPriestConfig,
} from '../../era/classes/priest'
import { calculateThreat } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  MindBlastR10: 25372,
  MindBlastR11: 25375,
  PrayerOfMending: 33110,
} as const

export const priestConfig: ClassThreatConfig = {
  ...eraPriestConfig,
  auraModifiers: {
    ...eraPriestConfig.auraModifiers,
    [Spells.ShadowAffinityRank1]: () => ({
      source: 'talent',
      name: 'Shadow Affinity (Rank 1)',
      value: 0.92,
      schoolMask: SpellSchool.Shadow,
    }),
    [Spells.ShadowAffinityRank2]: () => ({
      source: 'talent',
      name: 'Shadow Affinity (Rank 2)',
      value: 0.84,
      schoolMask: SpellSchool.Shadow,
    }),
    [Spells.ShadowAffinityRank3]: () => ({
      source: 'talent',
      name: 'Shadow Affinity (Rank 3)',
      value: 0.75,
      schoolMask: SpellSchool.Shadow,
    }),
  },
  abilities: {
    ...eraPriestConfig.abilities,
    [Spells.MindBlastR1]: calculateThreat({ modifier: 1 }),
    [Spells.MindBlastR2]: calculateThreat({ modifier: 1 }),
    [Spells.MindBlastR3]: calculateThreat({ modifier: 1 }),
    [Spells.MindBlastR4]: calculateThreat({ modifier: 1 }),
    [Spells.MindBlastR5]: calculateThreat({ modifier: 1 }),
    [Spells.MindBlastR6]: calculateThreat({ modifier: 1 }),
    [Spells.MindBlastR7]: calculateThreat({ modifier: 1 }),
    [Spells.MindBlastR8]: calculateThreat({ modifier: 1 }),
    [Spells.MindBlastR9]: calculateThreat({ modifier: 1 }),
    [Spells.MindBlastR10]: calculateThreat({ modifier: 1 }),
    [Spells.MindBlastR11]: calculateThreat({ modifier: 1 }),
  },
}
