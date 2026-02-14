/**
 * Anniversary Edition Threat Configuration
 *
 * Anniversary config for WCL gameVersion 2 reports that resolve to
 * Anniversary-specific metadata (season/partition).
 */
import type {
  SpellId,
  ThreatConfig,
  ThreatConfigResolutionInput,
} from '@wcl-threat/shared'

import { eraConfig } from '../era'
import { baseThreat } from '../era/general'
import {
  getClassicSeasonIds,
  hasZonePartition,
  validateAbilities,
  validateAuraModifiers,
} from '../shared/utils'
import { aq40Abilities } from '../sod/raids/aq40'
import { mcAbilities } from '../sod/raids/mc'
import { zgAbilities } from '../sod/raids/zg'
import { druidConfig } from './classes/druid'
import { hunterConfig } from './classes/hunter'
import { mageConfig } from './classes/mage'
import { paladinConfig } from './classes/paladin'
import { priestConfig } from './classes/priest'
import { rogueConfig } from './classes/rogue'
import { shamanConfig } from './classes/shaman'
import { warlockConfig } from './classes/warlock'
import { warriorConfig } from './classes/warrior'
import { miscAbilities } from './misc'
import { aq40AggroLossBuffs, aq40AuraModifiers } from './raids/aq40'
import { bwlAbilities, bwlAggroLossBuffs } from './raids/bwl'
import { mcAggroLossBuffs } from './raids/mc'
import { naxxAbilities } from './raids/naxx'
import { onyxiaAbilities } from './raids/ony'
import { zgAggroLossBuffs, zgEncounters } from './raids/zg'

const ANNIVERSARY_CLASSIC_SEASON_ID = 5

// Fixate buffs (taunt effects)
// Class-specific fixates are in class configs
const fixateBuffs = new Set<SpellId>([...(eraConfig.fixateBuffs ?? []), ...[]])

// Aggro loss buffs (fear, polymorph, etc.)
// Class-specific aggro loss buffs are in class configs
const aggroLossBuffs = new Set<SpellId>([
  ...bwlAggroLossBuffs,
  ...mcAggroLossBuffs,
  ...aq40AggroLossBuffs,
  ...zgAggroLossBuffs,
])

// Invulnerability buffs
// Class-specific invulnerabilities are in class configs
const invulnerabilityBuffs = new Set<SpellId>([
  ...(eraConfig.invulnerabilityBuffs ?? []),
  ...[],
])

// Global aura modifiers (items, consumables, cross-class buffs)
const globalAuraModifiers = {
  ...aq40AuraModifiers,
}

export const anniversaryConfig: ThreatConfig = {
  version: '1.3.1',
  displayName: 'Anniversary (TBC)',
  resolve: (input: ThreatConfigResolutionInput): boolean => {
    if (input.gameVersion !== 2) {
      return false
    }

    const seasonIds = getClassicSeasonIds(input)
    if (seasonIds.length > 0) {
      return seasonIds.includes(ANNIVERSARY_CLASSIC_SEASON_ID)
    }

    return hasZonePartition(input, ['phase', 'pre-patch'])
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
    ...bwlAbilities,
    ...mcAbilities,
    ...zgAbilities,
    ...aq40Abilities,
    ...miscAbilities,
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
validateAuraModifiers(anniversaryConfig)
validateAbilities(anniversaryConfig)
