/**
 * Temple of Ahn'Qiraj Abilities - Season of Discovery
 */
import type {
  SpellId,
  ThreatContext,
  ThreatFormula,
  ThreatModifier,
} from '@wow-threat/shared'

import {
  aq40AggroLossBuffs as eraAq40AggroLossBuffs,
  aq40AuraModifiers as eraAq40AuraModifiers,
} from '../../era/raids/aq40'
import { modifyThreat, modifyThreatOnHit } from '../../shared/formulas'

export const aq40Abilities: Record<number, ThreatFormula> = {
  800: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['applybuff'] }), // Twin Emperors Teleport
  26102: modifyThreatOnHit(0), // Ouro Sand Blast
  26580: modifyThreatOnHit(0), // Princess Yauj Fear
  26561: modifyThreat({ modifier: 0, target: 'all', eventTypes: ['cast'] }), // Vem Berserker Charge
  11130: modifyThreatOnHit(0.5), // Qiraji Champion Knock Away
}

export const aq40AuraModifiers: Record<
  SpellId,
  (ctx: ThreatContext) => ThreatModifier
> = {
  ...eraAq40AuraModifiers,
}

export const aq40AggroLossBuffs: ReadonlySet<SpellId> = new Set([
  ...eraAq40AggroLossBuffs,
])
