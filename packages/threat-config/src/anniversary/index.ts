/**
 * Anniversary Edition Threat Configuration
 *
 * This is the main entry point for Anniversary Edition (gameVersion: 1) threat config.
 */

import type { ThreatConfig, ThreatContext, ThreatModifier } from '../types'
import { validateAuraModifiers } from '../shared/utils'
import { baseThreat } from './general'
import { warriorConfig } from './classes/warrior'
import { paladinConfig } from './classes/paladin'
import { druidConfig } from './classes/druid'
import { priestConfig } from './classes/priest'
import { rogueConfig } from './classes/rogue'
import { hunterConfig } from './classes/hunter'
import { mageConfig } from './classes/mage'
import { warlockConfig } from './classes/warlock'
import { shamanConfig } from './classes/shaman'

// Creature GUIDs that cannot be taunted
const untauntableEnemies = new Set<number>([
  // Add boss GUIDs here as needed
  // e.g., 15990 for Kel'Thuzad during certain phases
])

// Fixate buffs (taunt effects)
// Class-specific fixates are in class configs
const fixateBuffs = new Set<number>([])

// Aggro loss buffs (fear, polymorph, etc.)
// Class-specific aggro loss buffs are in class configs
const aggroLossBuffs = new Set<number>([
  23023, // Razorgore Conflagrate
  23310, 23311, 23312, // Chromaggus Time Lapse
  22289, // Brood Power: Green
  20604, // Lucifron Dominate Mind
  24327, // Hakkar's Cause Insanity
  23603, // Nefarian: Wild Polymorph
  26580, // Princess Yauj: Fear
])

// Invulnerability buffs
// Class-specific invulnerabilities are in class configs
const invulnerabilityBuffs = new Set<number>([
  // Items
  3169, // Limited Invulnerability Potion
  6724, // Light of Elune
])

// Global aura modifiers (items, consumables, cross-class buffs)
const globalAuraModifiers: Record<number, (ctx: ThreatContext) => ThreatModifier> = {
  // Fetish of the Sand Reaver - 0.3x threat
  26400: () => ({
    source: 'gear',
    name: 'Fetish of the Sand Reaver',
    value: 0.3,
  }),
}

export const anniversaryConfig: ThreatConfig = {
  version: '1.1.0',
  gameVersion: 1,

  baseThreat,

  classes: {
    warrior: warriorConfig,
    paladin: paladinConfig,
    druid: druidConfig,
    priest: priestConfig,
    rogue: rogueConfig,
    hunter: hunterConfig,
    mage: mageConfig,
    warlock: warlockConfig,
    shaman: shamanConfig,
  },

  auraModifiers: globalAuraModifiers,
  untauntableEnemies,
  fixateBuffs,
  aggroLossBuffs,
  invulnerabilityBuffs,
}

// Validate for duplicate spell IDs (dev-time warning)
validateAuraModifiers(anniversaryConfig)

