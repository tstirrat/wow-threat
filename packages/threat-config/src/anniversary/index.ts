/**
 * Anniversary Edition Threat Configuration
 *
 * Anniversary config for WCL gameVersion 2 reports that resolve to
 * Anniversary-specific metadata (season/partition).
 */
import type {
  ThreatConfig,
  ThreatConfigResolutionInput,
  ThreatContext,
  ThreatModifier,
} from '@wcl-threat/shared'

import { validateAbilities, validateAuraModifiers } from '../shared/utils'
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
import { naxxAbilities } from './naxx'
import { onyxiaAbilities } from './ony'
import { zgEncounters } from './zg'

// Fixate buffs (taunt effects)
// Class-specific fixates are in class configs
const fixateBuffs = new Set<number>([])

// Aggro loss buffs (fear, polymorph, etc.)
// Class-specific aggro loss buffs are in class configs
const aggroLossBuffs = new Set<number>([
  23023, // Razorgore Conflagrate
  23310,
  23311,
  23312, // Chromaggus Time Lapse
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
const globalAuraModifiers: Record<
  number,
  (ctx: ThreatContext) => ThreatModifier
> = {
  // Fetish of the Sand Reaver - 0.3x threat
  26400: () => ({
    source: 'gear',
    name: 'Fetish of the Sand Reaver',
    value: 0.3,
  }),
}

const ANNIVERSARY_CLASSIC_SEASON_ID = 5

function getClassicSeasonIds(input: ThreatConfigResolutionInput): number[] {
  return Array.from(
    new Set(
      input.fights
        .map((fight) => fight.classicSeasonID)
        .filter((seasonId): seasonId is number => seasonId != null),
    ),
  )
}

function hasAnniversaryPartition(input: ThreatConfigResolutionInput): boolean {
  return (input.zone.partitions ?? []).some((partition) => {
    const name = partition.name.toLowerCase()
    return name.includes('phase') || name.includes('pre-patch')
  })
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

    return hasAnniversaryPartition(input)
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
validateAuraModifiers(anniversaryConfig)
validateAbilities(anniversaryConfig)
