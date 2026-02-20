/**
 * Priest Threat Configuration - Season of Discovery
 */
import type { ClassThreatConfig } from '@wow-threat/shared'
import type { GearItem } from '@wow-threat/wcl-types'

import { priestConfig as eraPriestConfig } from '../../era/classes/priest'

export const Buffs = {
  SE_DPS_4pc: 1226591,
} as const

const SetIds = {
  SE_DPS: 1938,
} as const

const Mods = {
  SE_DPS_4pcMindBlast: 0.5,
} as const

const MIND_BLAST_SPELL_IDS = new Set<number>([
  8092, 8102, 8103, 8104, 8105, 8106, 10945, 10946, 10947,
])

function inferGearAuras(gear: GearItem[]): number[] {
  const inheritedAuras = eraPriestConfig.gearImplications?.(gear) ?? []
  const inferredAuras = new Set<number>(inheritedAuras)
  const SE_DPS_Pieces = gear.filter(
    (item) => item.setID === SetIds.SE_DPS,
  ).length

  if (SE_DPS_Pieces >= 4) {
    inferredAuras.add(Buffs.SE_DPS_4pc)
  }

  return [...inferredAuras]
}

export const priestConfig: ClassThreatConfig = {
  ...eraPriestConfig,

  auraModifiers: {
    ...eraPriestConfig.auraModifiers,
    [Buffs.SE_DPS_4pc]: () => ({
      source: 'gear',
      name: 'S03 - Item - Scarlet Enclave - Priest - Shadow 4P Bonus',
      spellIds: MIND_BLAST_SPELL_IDS,
      value: Mods.SE_DPS_4pcMindBlast,
    }),
  },

  gearImplications: inferGearAuras,
}
