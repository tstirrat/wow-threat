/**
 * Black Temple raid mechanics for Anniversary/TBC.
 */
import type {
  SpellId,
  ThreatContext,
  ThreatFormula,
  ThreatModifier,
} from '@wcl-threat/shared'

import {
  modifyThreat,
  modifyThreatOnHit,
  noThreat,
} from '../../shared/formulas'

const noThreatFormula = noThreat()

export const blackTempleFixateBuffs: ReadonlySet<SpellId> = new Set([
  40604, // Gurtogg - Fel Rage
])

export const blackTempleAuraModifiers: Record<
  number,
  (ctx: ThreatContext) => ThreatModifier
> = {
  40618: () => ({
    source: 'buff',
    name: 'Insignificance',
    value: 0,
  }),
}

export const blackTempleAbilities: Record<number, ThreatFormula> = {
  40486: modifyThreatOnHit(0.75), // Gurtogg Bloodboil
  40597: modifyThreatOnHit(0.75), // Gurtogg Eject
  40618: noThreatFormula, // Insignificance
  40647: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['cast'] }), // Illidan Shadow Prison
  39635: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['cast'] }), // Illidan phase transition
  39873: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['cast'] }), // Illidan glaive return
  41476: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['cast'] }), // Council vanish reset
  41470: noThreatFormula, // Reflect damage bookkeeping handled outside formula layer
}
