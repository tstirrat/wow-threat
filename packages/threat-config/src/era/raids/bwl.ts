/**
 * Blackwing Lair Raid Config
 *
 * Raid-specific spell sets and encounter rules for Blackwing Lair.
 */
import type { SpellId } from '@wcl-threat/shared'

/**
 * Aggro-loss buffs from Blackwing Lair bosses.
 */
export const bwlAggroLossBuffs: ReadonlySet<SpellId> = new Set([
  23023, // Razorgore Conflagrate
  23310,
  23311,
  23312, // Chromaggus Time Lapse
  22289, // Brood Power: Green
  23603, // Nefarian: Wild Polymorph
])
