/**
 * Anniversary Naxxramas deltas over Era.
 */
import type { Abilities } from '@wow-threat/shared'

import {
  Spells as EraSpells,
  naxxAbilities as eraNaxxAbilities,
} from '../../era/raids/naxx'
import { createHurtfulStrikeFormula } from './hurtful-strike'

const Spells = {
  ...EraSpells,
  HatefulStrike: 28308, // https://www.wowhead.com/tbc/spell=28308/hateful-strike
} as const

export const naxxAbilities: Abilities = {
  ...eraNaxxAbilities,
  [Spells.HatefulStrike]: createHurtfulStrikeFormula(1000, 2000),
}
