/**
 * Shaman Threat Configuration - Season of Discovery
 */
import type { ClassThreatConfig } from '@wow-threat/shared'
import type { GearItem } from '@wow-threat/wcl-types'

import {
  Spells as EraSpells,
  shamanConfig as eraShamanConfig,
} from '../../era/classes/shaman'
import { tauntTarget, threat } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  WayOfEarth: 408531,
  SpiritOfTheAlpha: 408696,
  LoyalBeta: 443320,
  TAQ_Tank_4pc: 1213937,
  ActivateWayOfEarth: 461635,
  EarthShockTaunt: 408690,
  MoltenBlast: 425339,
} as const

const SetIds = {
  TAQ_Tank: 1852,
} as const

const Enchants = {
  SoulOfTheAlpha: 7683,
  RockbiterWeapon: 7568,
} as const

const Mods = {
  MoltenBlast: 2,
  SpiritOfTheAlpha: 1.45,
  LoyalBeta: 0.7,
  TAQ_Tank_4pc: 1.2,
  WayOfEarth: 1.65,
} as const

function inferGearAuras(gear: GearItem[]): number[] {
  const inheritedAuras = eraShamanConfig.gearImplications?.(gear) ?? []
  const inferredAuras = new Set<number>(inheritedAuras)
  const taq_TankPieces = gear.filter(
    (item) => item.setID === SetIds.TAQ_Tank,
  ).length

  if (
    taq_TankPieces >= 4 ||
    gear.some((item) => item.temporaryEnchant === Enchants.SoulOfTheAlpha)
  ) {
    inferredAuras.add(Spells.TAQ_Tank_4pc)
  }

  if (gear.some((item) => item.temporaryEnchant === Enchants.RockbiterWeapon)) {
    inferredAuras.add(Spells.ActivateWayOfEarth)
  }

  return [...inferredAuras]
}

function buildAuraImplications(): Map<number, ReadonlySet<number>> | undefined {
  const baseMap = eraShamanConfig.auraImplications
  const mergedMap = new Map<number, ReadonlySet<number>>(baseMap ?? [])
  const impliedAbilities = new Set(mergedMap.get(Spells.SpiritOfTheAlpha) ?? [])
  impliedAbilities.add(Spells.MoltenBlast)
  mergedMap.set(Spells.SpiritOfTheAlpha, impliedAbilities)
  return mergedMap
}

export const shamanConfig: ClassThreatConfig = {
  ...eraShamanConfig,

  auraModifiers: {
    ...eraShamanConfig.auraModifiers,
    [Spells.SpiritOfTheAlpha]: () => ({
      source: 'aura',
      name: 'Spirit of the Alpha',
      value: Mods.SpiritOfTheAlpha,
    }),
    [Spells.LoyalBeta]: () => ({
      source: 'aura',
      name: 'Loyal Beta',
      value: Mods.LoyalBeta,
    }),
    [Spells.TAQ_Tank_4pc]: (ctx) => ({
      source: 'gear',
      name: 'S03 - TAQ - Shaman - Tank - 4pc',
      value: ctx.sourceAuras.has(Spells.SpiritOfTheAlpha)
        ? Mods.TAQ_Tank_4pc
        : 1,
    }),
    [Spells.WayOfEarth]: (ctx) => ({
      source: 'aura',
      name: 'Way of Earth',
      value: ctx.sourceAuras.has(Spells.ActivateWayOfEarth)
        ? Mods.WayOfEarth
        : 1,
    }),
  },

  abilities: {
    ...eraShamanConfig.abilities,
    [Spells.EarthShockTaunt]: tauntTarget({ modifier: 2 }),
    [Spells.MoltenBlast]: threat({ modifier: Mods.MoltenBlast }),
  },

  fixateBuffs: new Set([
    ...(eraShamanConfig.fixateBuffs ?? []),
    Spells.EarthShockTaunt,
  ]),
  auraImplications: buildAuraImplications(),
  gearImplications: inferGearAuras,
}
