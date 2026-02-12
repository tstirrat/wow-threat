/**
 * Molten Core Raid Config
 *
 * Raid-specific spell sets and encounter rules for Molten Core.
 */
import type { SpellId } from '@wcl-threat/shared'

/**
 * Aggro-loss buffs from Molten Core bosses.
 */
export const mcAggroLossBuffs: ReadonlySet<SpellId> = new Set([
  20604, // Lucifron Dominate Mind
])
