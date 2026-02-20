/**
 * Hunter Threat Configuration - Season of Discovery
 */
import type { ClassThreatConfig } from '@wow-threat/shared'

import {
  Spells as EraSpells,
  hunterConfig as eraHunterConfig,
} from '../../era/classes/hunter'
import { createMisdirectionInterceptor } from '../../tbc/classes/hunter'

export const Spells = {
  ...EraSpells,
  Misdirection: 34477, // https://www.wowhead.com/classic/spell=34477/
  MisdirectionBuff: 35079, // https://www.wowhead.com/classic/spell=35079/
  S03T1HunterRanged2pc: 456339, // https://www.wowhead.com/classic/spell=456339/
} as const

const Mods = {
  S03T1HunterRanged2pc: 2,
} as const

export const hunterConfig: ClassThreatConfig = {
  ...eraHunterConfig,
  abilities: {
    ...eraHunterConfig.abilities,
    [Spells.Misdirection]: (ctx) => ({
      formula: '0',
      value: 0,
      splitAmongEnemies: false,
      effects: [
        {
          type: 'installInterceptor',
          interceptor: createMisdirectionInterceptor(
            ctx.sourceActor.id,
            ctx.event.targetID,
          ),
        },
      ],
    }),
  },
  auraModifiers: {
    ...eraHunterConfig.auraModifiers,
    [Spells.S03T1HunterRanged2pc]: () => ({
      source: 'gear',
      name: 'S03 T1 Hunter Ranged 2pc',
      value: Mods.S03T1HunterRanged2pc,
    }),
  },
}
