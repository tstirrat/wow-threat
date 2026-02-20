/**
 * Onyxia Boss Abilities
 *
 * Custom threat formulas for Onyxia's Lair in Anniversary Edition.
 */
import { modifyThreat, modifyThreatOnHit } from '../../shared/formulas'

export const Spells = {
  KnockAway: 19633,
  Fireball: 18392,
} as const

/**
 * Onyxia boss abilities
 */
export const onyxiaAbilities = {
  [Spells.KnockAway]: modifyThreatOnHit(0.75),
  [Spells.Fireball]: modifyThreat({ modifier: 0, eventTypes: ['cast'] }),
}
