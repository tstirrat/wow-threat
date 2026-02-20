/**
 * Gruul's Lair raid mechanics for Anniversary/TBC.
 */
import type { Abilities } from '@wow-threat/shared'

import { modifyThreat } from '../../shared/formulas'
import { createHurtfulStrikeFormula } from './hurtful-strike'

const Spells = {
  // Kiggler the Crazed arcane explosion - HKM fight
  ArcaneExplosion: 33237, // https://www.wowhead.com/tbc/spell=33237/arcane-explosion
  HurtfulStrike: 33813, // https://www.wowhead.com/tbc/spell=33813/hurtful-strike
} as const

export const gruulsLairAbilities: Abilities = {
  [Spells.ArcaneExplosion]: modifyThreat({
    modifier: 0,
    target: 'all',
    eventTypes: ['cast'],
  }),
  [Spells.HurtfulStrike]: createHurtfulStrikeFormula(1500, 0),
}
