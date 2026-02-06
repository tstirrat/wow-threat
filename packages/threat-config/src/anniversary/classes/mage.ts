/**
 * Mage Threat Configuration - Anniversary Edition
 *
 * Mages have talent-based threat reduction. Ice Block grants invulnerability.
 */
import type { ClassThreatConfig } from '../../types'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  IceBlock: 11958,

  // Polymorph (various forms) - causes aggro loss
  PolymorphR1: 118,
  PolymorphR2: 12824,
  PolymorphR3: 12825,
  PolymorphPig: 28272,
  PolymorphTurtle: 28271,
  PolymorphR4: 12826,
} as const

// ============================================================================
// Modifiers
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Mods = {
  BurningSoul: 0.15, // 15% per rank (up to 30%)
  FrostChanneling: 0.1, // 10% per rank (up to 30%)
  ArcaneSubtlety: 0.2, // 20% per rank (up to 40%)
}

// ============================================================================
// Configuration
// ============================================================================

export const mageConfig: ClassThreatConfig = {
  auraModifiers: {
    // TODO: [Arcane Subtlety] Talent - 20% per rank arcane threat reduction
    // TODO: [Burning Soul] Talent - 15% per rank fire threat reduction
    // TODO: [Frost Channeling] Talent - 10% per rank frost threat reduction
  },

  abilities: {
    // Ice Block is handled as invulnerability buff, not here
    // TODO: [11958] Ice Block - mark as invulnerability buff
  },

  aggroLossBuffs: new Set([
    Spells.PolymorphR1,
    Spells.PolymorphR2,
    Spells.PolymorphR3,
    Spells.PolymorphPig,
    Spells.PolymorphTurtle,
    Spells.PolymorphR4,
  ]),

  invulnerabilityBuffs: new Set([Spells.IceBlock]),
}
