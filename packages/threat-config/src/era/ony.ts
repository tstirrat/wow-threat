/**
 * Onyxia Boss Abilities
 *
 * Custom threat formulas for Onyxia's Lair in Anniversary Edition.
 */
import type { ThreatFormula } from '@wcl-threat/shared'

import { modifyThreat } from '../shared/formulas'

export const Spells = {
  KnockAway: 19633,
} as const

/**
 * Onyxia - Knock Away
 *
 * Knocks back the target and reduces their threat by 25%.
 * Applied to the target hit by the knockback.
 */
export const knockAway: ThreatFormula = modifyThreat({ modifier: 0.75 })

/**
 * Onyxia boss abilities
 */
export const onyxiaAbilities = {
  [Spells.KnockAway]: knockAway,
}
