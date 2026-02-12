/**
 * Vanilla Era Threat Configuration
 *
 * Era config currently mirrors Anniversary behavior, but uses Era-specific
 * resolver logic.
 */
import type {
  SpellId,
  ThreatConfig,
  ThreatConfigResolutionInput,
} from '@wcl-threat/shared'

import { validateAbilities, validateAuraModifiers } from '../shared/utils'
import { druidConfig } from './classes/druid'
import { hunterConfig } from './classes/hunter'
import { mageConfig } from './classes/mage'
import { paladinConfig } from './classes/paladin'
import { priestConfig } from './classes/priest'
import { rogueConfig } from './classes/rogue'
import { aq40AggroLossBuffs, aq40AuraModifiers } from './raids/aq40'
import { bwlAggroLossBuffs } from './raids/bwl'
import { mcAggroLossBuffs } from './raids/mc'
import { naxxAbilities } from './raids/naxx'
import { onyxiaAbilities } from './raids/ony'
import { zgAggroLossBuffs, zgEncounters } from './raids/zg'
import { shamanConfig } from './classes/shaman'
import { warlockConfig } from './classes/warlock'
import { warriorConfig } from './classes/warrior'
import { baseThreat } from './general'

// Fixate buffs (taunt effects)
// Class-specific fixates are in class configs
const fixateBuffs = new Set<SpellId>([])

// Aggro loss buffs (fear, polymorph, etc.)
// Class-specific aggro loss buffs are in class configs
const aggroLossBuffs = new Set<SpellId>([
  ...bwlAggroLossBuffs,
  ...mcAggroLossBuffs,
  ...zgAggroLossBuffs,
  ...aq40AggroLossBuffs,
])

// Invulnerability buffs
// Class-specific invulnerabilities are in class configs
const invulnerabilityBuffs = new Set<SpellId>([
  // Items
  3169, // Limited Invulnerability Potion
  6724, // Light of Elune
])

// Global aura modifiers (items, consumables, cross-class buffs)
const globalAuraModifiers = {
  ...aq40AuraModifiers,
}

function getClassicSeasonIds(input: ThreatConfigResolutionInput): number[] {
  return Array.from(
    new Set(
      input.fights
        .map((fight) => fight.classicSeasonID)
        .filter((seasonId): seasonId is number => seasonId != null),
    ),
  )
}

function hasEraPartition(input: ThreatConfigResolutionInput): boolean {
  return (input.zone.partitions ?? []).some((partition) => {
    const name = partition.name.toLowerCase()
    return name.includes('s0') || name.includes('hardcore') || name.includes('som')
  })
}

export const eraConfig: ThreatConfig = {
  version: '1.3.1',
  displayName: 'Vanilla (Era)',
  resolve: (input: ThreatConfigResolutionInput): boolean => {
    if (input.gameVersion !== 2) {
      return false
    }

    if (getClassicSeasonIds(input).length > 0) {
      return false
    }

    return hasEraPartition(input)
  },

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

  abilities: {
    ...naxxAbilities,
    ...onyxiaAbilities,
  },

  auraModifiers: globalAuraModifiers,
  fixateBuffs,
  aggroLossBuffs,
  invulnerabilityBuffs,
  encounters: {
    ...zgEncounters,
  },
}

// Validate for duplicate spell IDs (dev-time warning)
validateAuraModifiers(eraConfig)
validateAbilities(eraConfig)
