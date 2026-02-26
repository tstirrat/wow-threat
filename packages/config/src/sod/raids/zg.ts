/**
 * Zul'Gurub Abilities and Encounter Hooks - Season of Discovery
 */
import type {
  EncounterId,
  EncounterThreatConfig,
  SpellId,
  ThreatFormula,
} from '@wow-threat/shared'

import {
  Spells as EraSpells,
  zgAbilities as eraZgAbilities,
  zgEncounters as eraZgEncounters,
} from '../../era/raids/zg'
import { modifyThreat } from '../../shared/formulas'

const Spells = {
  ...EraSpells,
  MandokirCharge: 24408, // https://www.wowhead.com/classic/spell=24408
  AspectOfArlokk: 24690, // https://www.wowhead.com/classic/spell=24690
} as const

export const zgAbilities: Record<SpellId, ThreatFormula> = {
  ...eraZgAbilities,
  [Spells.MandokirCharge]: modifyThreat({
    modifier: 0,
    target: 'all',
    eventTypes: ['cast'],
  }),
  [Spells.AspectOfArlokk]: modifyThreat({
    modifier: 0,
    eventTypes: ['applydebuff'],
  }),
}

export const zgEncounters: Record<EncounterId, EncounterThreatConfig> = {
  ...eraZgEncounters,
}
