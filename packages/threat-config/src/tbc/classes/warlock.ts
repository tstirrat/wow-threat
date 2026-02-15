/**
 * Anniversary warlock deltas over Era.
 *
 * Adds TBC Soulshatter and Destructive Reach talent reduction.
 */
import type {
  ClassThreatConfig,
  SpellId,
  TalentImplicationContext,
} from '@wcl-threat/shared'

import {
  Spells as EraSpells,
  warlockConfig as eraWarlockConfig,
} from '../../era/classes/warlock'
import { modifyThreat } from '../../shared/formulas'
import { inferTalent } from '../../shared/talents'

export const Spells = {
  ...EraSpells,
  Soulshatter: 29858,
  DestructiveReachRank1: 910201,
  DestructiveReachRank2: 910202,
} as const

const DESTRUCTION = 2
const DESTRUCTIVE_REACH_THRESHOLD = 8

export const warlockConfig: ClassThreatConfig = {
  ...eraWarlockConfig,

  auraModifiers: {
    ...eraWarlockConfig.auraModifiers,
    [Spells.DestructiveReachRank1]: () => ({
      source: 'talent',
      name: 'Destructive Reach (Rank 1)',
      value: 0.95,
    }),
    [Spells.DestructiveReachRank2]: () => ({
      source: 'talent',
      name: 'Destructive Reach (Rank 2)',
      value: 0.9,
    }),
  },

  abilities: {
    ...eraWarlockConfig.abilities,
    [Spells.Soulshatter]: modifyThreat({
      modifier: 0.5,
      target: 'all',
      eventTypes: ['cast'],
    }),
  },

  talentImplications: (ctx: TalentImplicationContext): SpellId[] => {
    const inferredAuras = [] as SpellId[]
    const destructiveReach = inferTalent(
      ctx,
      [Spells.DestructiveReachRank1, Spells.DestructiveReachRank2],
      (points) => (points[DESTRUCTION] >= DESTRUCTIVE_REACH_THRESHOLD ? 2 : 0),
    )
    if (destructiveReach) {
      inferredAuras.push(destructiveReach as SpellId)
    }
    return inferredAuras
  },
}
