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
  ThreatContext,
  ThreatModifier,
} from '@wow-threat/shared'
import type { GearItem } from '@wow-threat/wcl-types'

import { eraConfig } from '../era'
import { baseThreat } from '../era/general'
import {
  FRESH_TBC_CUTOVER_TIMESTAMP_MS,
  getClassicSeasonIds,
  hasZonePartition,
  isSupportedClassicGameVersion,
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
import {
  blackTempleAbilities,
  blackTempleAuraModifiers,
  blackTempleFixateBuffs,
} from './raids/black-temple'
import { bwlAbilities, bwlAggroLossBuffs } from './raids/bwl'
import { commonRaidAbilities } from './raids/common'
import { gruulsLairAbilities } from './raids/gruuls-lair'
import { karazhanAbilities } from './raids/karazhan'
import { mcAggroLossBuffs } from './raids/mc'
import { naxxAbilities } from './raids/naxx'
import { onyxiaAbilities } from './raids/ony'
import { serpentshrineCavernAbilities } from './raids/serpentshrine-cavern'
import { tempestKeepAbilities } from './raids/tempest-keep'
import { zgAggroLossBuffs, zgEncounters } from './raids/zg'

const ANNIVERSARY_CLASSIC_SEASON_ID = 5
const Enchants = {
  GlovesThreat: 2613,
  CloakSubtlety: 2621,
} as const

// Fixate buffs (taunt effects)
// Class-specific fixates are in class configs
const fixateBuffs = new Set<SpellId>([
  ...(eraConfig.fixateBuffs ?? []),
  ...blackTempleFixateBuffs,
])

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
const globalAuraModifiers: Record<
  number,
  (ctx: ThreatContext) => ThreatModifier
> = {
  ...(eraConfig.auraModifiers ?? {}),
  ...aq40AuraModifiers,
  ...blackTempleAuraModifiers,
  [Enchants.GlovesThreat]: () => ({
    source: 'gear',
    name: 'Enchant Gloves - Threat',
    value: 1.02,
  }),
  [Enchants.CloakSubtlety]: () => ({
    source: 'gear',
    name: 'Enchant Cloak - Subtlety',
    value: 0.98,
  }),
}

function inferGlobalGearAuras(gear: GearItem[]): number[] {
  const inferredAuras: number[] = []

  if (gear.some((item) => item.permanentEnchant === Enchants.GlovesThreat)) {
    inferredAuras.push(Enchants.GlovesThreat)
  }
  if (gear.some((item) => item.permanentEnchant === Enchants.CloakSubtlety)) {
    inferredAuras.push(Enchants.CloakSubtlety)
  }

  return inferredAuras
}

export const anniversaryConfig: ThreatConfig = {
  version: '1.3.3',
  displayName: 'TBC (Anniversary)',
  wowhead: {
    domain: 'tbc',
  },
  resolve: (input: ThreatConfigResolutionInput): boolean => {
    if (!isSupportedClassicGameVersion(input.report.masterData.gameVersion)) {
      return false
    }

    if (input.report.startTime < FRESH_TBC_CUTOVER_TIMESTAMP_MS) {
      return false
    }

    const seasonIds = getClassicSeasonIds(input)
    if (seasonIds.length > 0) {
      return seasonIds.includes(ANNIVERSARY_CLASSIC_SEASON_ID)
    }

    if (!hasZonePartition(input, ['phase', 'pre-patch'])) {
      return false
    }

    return true
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
    ...commonRaidAbilities,
    ...karazhanAbilities,
    ...serpentshrineCavernAbilities,
    ...tempestKeepAbilities,
    ...gruulsLairAbilities,
    ...blackTempleAbilities,
    ...miscAbilities,
  },

  auraModifiers: globalAuraModifiers,
  gearImplications: inferGlobalGearAuras,
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
