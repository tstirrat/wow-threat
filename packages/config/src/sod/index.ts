/**
 * Season of Discovery Threat Configuration
 *
 * Ports upstream SoD global behavior from:
 * https://github.com/Voomlz/voomlz.github.io/blob/master/sod/spells.js
 */
import type {
  ThreatConfig,
  ThreatContext,
  ThreatModifier,
} from '@wow-threat/shared'
import type { GearItem } from '@wow-threat/wcl-types'

import { eraConfig } from '../era'
import { baseThreat } from '../era/general'
import {
  getClassicSeasonIds,
  hasZonePartition,
  isSupportedClassicGameVersion,
  validateAbilities,
  validateAuraModifiers,
} from '../shared/utils'
import { sodClasses } from './classes'
import { miscAbilities } from './misc'
import {
  aq40Abilities,
  aq40AggroLossBuffs,
  aq40AuraModifiers,
} from './raids/aq40'
import { bwlAbilities } from './raids/bwl'
import { mcAbilities } from './raids/mc'
import { naxxAbilities } from './raids/naxx'
import { onyxiaAbilities } from './raids/onyxia'
import { zgAbilities, zgEncounters } from './raids/zg'

// ============================================================================
// SoD Constants
// ============================================================================

const SOD_CLASSIC_SEASON_ID = 3

const Items = {
  EnchantGlovesThreat: 25072,
  EnchantCloakSubtlety: 25084,
  EyeOfDiminution: 1219503,
} as const

const Mods = {
  GlovesThreat: 1.02,
  CloakSubtlety: 0.98,
  EyeOfDiminution: 0.3,
} as const

const eraAuraModifiers = eraConfig.auraModifiers ?? {}
const auraModifiers: Record<number, (ctx: ThreatContext) => ThreatModifier> = {
  ...eraAuraModifiers,
  ...aq40AuraModifiers,
  [Items.EnchantGlovesThreat]: () => ({
    source: 'gear',
    name: 'Enchant Gloves - Threat',
    value: Mods.GlovesThreat,
  }),
  [Items.EnchantCloakSubtlety]: () => ({
    source: 'gear',
    name: 'Enchant Cloak - Subtlety',
    value: Mods.CloakSubtlety,
  }),
  [Items.EyeOfDiminution]: () => ({
    source: 'gear',
    name: 'The Eye of Diminution',
    value: Mods.EyeOfDiminution,
  }),
}

const aggroLossBuffs = new Set<number>([
  ...(eraConfig.aggroLossBuffs ?? []),
  ...aq40AggroLossBuffs,
])

const invulnerabilityBuffs = new Set<number>([
  ...(eraConfig.invulnerabilityBuffs ?? []),
  ...[],
])

function inferGlobalGearAuras(gear: GearItem[]): number[] {
  const inferredAuras: number[] = []

  if (
    gear.some((item) => item.permanentEnchant === Items.EnchantGlovesThreat)
  ) {
    inferredAuras.push(Items.EnchantGlovesThreat)
  }

  if (
    gear.some((item) => item.permanentEnchant === Items.EnchantCloakSubtlety)
  ) {
    inferredAuras.push(Items.EnchantCloakSubtlety)
  }

  return inferredAuras
}

export const sodConfig: ThreatConfig = {
  version: 6,
  displayName: 'Season of Discovery',
  wowhead: {
    domain: 'classic',
  },
  resolve: (input) => {
    if (!isSupportedClassicGameVersion(input.report.masterData.gameVersion)) {
      return false
    }

    const seasonIds = getClassicSeasonIds(input)
    if (seasonIds.length > 0) {
      return seasonIds.includes(SOD_CLASSIC_SEASON_ID)
    }

    return hasZonePartition(input, ['discovery'])
  },

  baseThreat,

  classes: sodClasses,
  abilities: {
    ...naxxAbilities,
    ...onyxiaAbilities,
    ...bwlAbilities,
    ...mcAbilities,
    ...zgAbilities,
    ...aq40Abilities,
    ...miscAbilities,
  },

  auraModifiers,
  gearImplications: inferGlobalGearAuras,
  aggroLossBuffs,
  invulnerabilityBuffs,
  encounters: {
    ...zgEncounters,
  },
}

validateAuraModifiers(sodConfig)
validateAbilities(sodConfig)
