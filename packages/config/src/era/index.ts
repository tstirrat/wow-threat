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
} from '@wow-threat/shared'

import {
  FRESH_TBC_CUTOVER_TIMESTAMP_MS,
  getClassicSeasonIds,
  hasZonePartition,
  isSupportedClassicGameVersion,
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

const SOD_CLASSIC_SEASON_ID = 3
const ANNIVERSARY_CLASSIC_SEASON_ID = 5

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
  version: 6,
  displayName: 'Vanilla (Era)',
  wowhead: {
    domain: 'classic',
  },
  resolve: (meta: ThreatConfigResolutionInput): boolean => {
    if (!isSupportedClassicGameVersion(meta.report.masterData.gameVersion)) {
      return false
    }

    const seasonIds = getClassicSeasonIds(meta)
    if (seasonIds.length > 0) {
      if (seasonIds.includes(SOD_CLASSIC_SEASON_ID)) {
        return false
      }

      if (
        seasonIds.every(
          (seasonId) => seasonId === ANNIVERSARY_CLASSIC_SEASON_ID,
        )
      ) {
        return meta.report.startTime < FRESH_TBC_CUTOVER_TIMESTAMP_MS
      }

      return false
    }

    if (hasZonePartition(meta, ['s0', 'hardcore', 'som'])) {
      return true
    }

    if (!hasZonePartition(meta, ['phase', 'pre-patch'])) {
      return false
    }

    return meta.report.startTime < FRESH_TBC_CUTOVER_TIMESTAMP_MS
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
