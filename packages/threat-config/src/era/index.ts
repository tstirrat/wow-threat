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

import {
  getClassicSeasonIds,
  hasZonePartition,
  validateAbilities,
  validateAuraModifiers,
} from '../shared/utils'
import { druidConfig } from './classes/druid'
import { hunterConfig } from './classes/hunter'
import { mageConfig } from './classes/mage'
import { paladinConfig } from './classes/paladin'
import { priestConfig } from './classes/priest'
import { rogueConfig } from './classes/rogue'
import { shamanConfig } from './classes/shaman'
import { warlockConfig } from './classes/warlock'
import { warriorConfig } from './classes/warrior'
import { baseThreat } from './general'
import { miscAbilities } from './misc'
import { aq40AggroLossBuffs, aq40AuraModifiers } from './raids/aq40'
import { bwlAbilities } from './raids/bwl'
import { bwlAggroLossBuffs } from './raids/bwl'
import { mcAggroLossBuffs } from './raids/mc'
import { naxxAbilities } from './raids/naxx'
import { onyxiaAbilities } from './raids/ony'
import { zgAggroLossBuffs, zgEncounters } from './raids/zg'

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

export const eraConfig: ThreatConfig = {
  version: '1.3.1',
  displayName: 'Vanilla (Era)',
  resolve: (meta: ThreatConfigResolutionInput): boolean => {
    if (meta.gameVersion !== 2) {
      return false
    }

    if (getClassicSeasonIds(meta).length > 0) {
      return false
    }

    return hasZonePartition(meta, ['s0', 'hardcore', 'som'])
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
    ...miscAbilities,
    ...bwlAbilities,
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
