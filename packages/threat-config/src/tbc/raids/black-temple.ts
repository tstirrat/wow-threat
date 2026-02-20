/**
 * Black Temple raid mechanics for Anniversary/TBC.
 */
import type { Abilities, AuraModifiers, SpellId } from '@wow-threat/shared'

import {
  modifyThreat,
  modifyThreatOnHit,
  noThreat,
} from '../../shared/formulas'

const noThreatFormula = noThreat()

const Spells = {
  Vanish: 41476, // https://www.wowhead.com/tbc/spell=41476/vanish
  ShadowPrison: 40647, // https://www.wowhead.com/tbc/spell=40647/shadow-prison
  GlaiveReturns: 39873, // https://www.wowhead.com/tbc/spell=39873/glaive-returns
  ThrowGlaive: 39635, // https://www.wowhead.com/tbc/spell=39635/throw-glaive
  Eject1: 40597, // https://www.wowhead.com/tbc/spell=40597/eject
  Eject2: 40486, // https://www.wowhead.com/tbc/spell=40486/eject
  Insignificance: 40618, // https://www.wowhead.com/tbc/spell=40618/insignificance
  FelRage: 40604, // https://www.wowhead.com/tbc/spell=40604/fel-rage
  JudgementOfCommand: 41470, // https://www.wowhead.com/tbc/spell=41470/judgement-of-command
} as const

export const blackTempleFixateBuffs: ReadonlySet<SpellId> = new Set([
  Spells.FelRage,
])

export const blackTempleAuraModifiers: AuraModifiers = {
  [Spells.Insignificance]: () => ({
    source: 'buff',
    name: 'Insignificance',
    value: 0,
  }),
}

export const blackTempleAbilities: Abilities = {
  // Bloodboil
  [Spells.Eject2]: modifyThreatOnHit(0.75), // Gurtogg Bloodboil
  [Spells.Eject1]: modifyThreatOnHit(0.75), // Gurtogg Eject
  [Spells.Insignificance]: noThreatFormula, // Insignificance

  // Illidan
  [Spells.ShadowPrison]: modifyThreat({
    modifier: 0,
    target: 'all',
    eventTypes: ['cast'],
  }),
  [Spells.ThrowGlaive]: modifyThreat({
    // Phase transition
    modifier: 0,
    target: 'all',
    eventTypes: ['cast'],
  }),
  [Spells.GlaiveReturns]: modifyThreat({
    modifier: 0,
    target: 'all',
    eventTypes: ['cast'],
  }),
  [Spells.Vanish]: modifyThreat({
    modifier: 0,
    target: 'all',
    eventTypes: ['cast'],
  }),
  // [Spells.JudgementOfCommand]: noThreatFormula, // TODO: why was this in BT config?
}
