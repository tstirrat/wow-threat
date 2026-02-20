/**
 * Zul'Gurub Abilities and Encounter Hooks - Season of Discovery
 */
import type {
  EncounterId,
  EncounterThreatConfig,
  ThreatFormula,
} from '@wow-threat/shared'

import { zgEncounters as eraZgEncounters } from '../../era/raids/zg'
import { modifyThreat } from '../../shared/formulas'

export const zgAbilities: Record<number, ThreatFormula> = {
  24408: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['cast'] }), // Bloodlord Mandokir Charge
  24690: modifyThreat({ modifier: 0, eventTypes: ['applydebuff'] }), // Hakkar's Aspect of Arlokk
}

export const zgEncounters: Record<EncounterId, EncounterThreatConfig> = {
  ...eraZgEncounters,
}
