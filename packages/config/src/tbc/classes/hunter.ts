/**
 * Hunter Threat Configuration - TBC (Anniversary)
 *
 * Inherits Era hunter behavior and adds Misdirection threat redirection.
 */
import type { ClassThreatConfig, EventInterceptor } from '@wow-threat/shared'

import {
  Spells as EraSpells,
  hunterConfig as eraHunterConfig,
} from '../../era/classes/hunter'
import { threat, threatOnDebuffOrDamage } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,
  Misdirection: 34477, // https://www.wowhead.com/tbc/spell=34477/
  MisdirectionBuff: 35079, // https://www.wowhead.com/tbc/spell=35079/
  DistractingShotR7: 27020, // https://www.wowhead.com/tbc/spell=27020/
  ExplosiveTrapEffectR1: 13812, // https://www.wowhead.com/tbc/spell=13812/
  ExplosiveTrapEffectR2: 14314, // https://www.wowhead.com/tbc/spell=14314/
  ExplosiveTrapEffectR3: 14315, // https://www.wowhead.com/tbc/spell=14315/
  ExplosiveTrapEffectR4: 27025, // https://www.wowhead.com/tbc/spell=27025/
  PetScreechR5: 27051, // https://www.wowhead.com/tbc/spell=27051/
} as const

const MISDIRECTION_DURATION_MS = 30000
const MISDIRECTION_MAX_CHARGES = 3

const misdirectionAoeOverflowSpellIds = new Set<number>([
  Spells.ExplosiveTrapEffectR1,
  Spells.ExplosiveTrapEffectR2,
  Spells.ExplosiveTrapEffectR3,
  Spells.ExplosiveTrapEffectR4,
])

interface RedirectOverflowWindow {
  abilityGameID: number
  timestamp: number
}

/** Create a Misdirection interceptor for a hunter and redirected ally target. */
export function createMisdirectionInterceptor(
  hunterId: number,
  targetId: number,
): EventInterceptor {
  let chargesRemaining = MISDIRECTION_MAX_CHARGES
  let redirectOverflowWindow: RedirectOverflowWindow | null = null

  return (event, ctx) => {
    if (ctx.timestamp - ctx.installedAt > MISDIRECTION_DURATION_MS) {
      ctx.uninstall()
      return { action: 'passthrough' }
    }

    if (redirectOverflowWindow !== null) {
      if (event.timestamp > redirectOverflowWindow.timestamp) {
        ctx.uninstall()
        return { action: 'passthrough' }
      }

      if (
        event.type === 'damage' &&
        event.sourceID === hunterId &&
        !event.tick &&
        event.abilityGameID === redirectOverflowWindow.abilityGameID &&
        event.timestamp === redirectOverflowWindow.timestamp
      ) {
        if (!ctx.actors.isActorAlive({ id: targetId })) {
          return { action: 'passthrough' }
        }

        return {
          action: 'augment',
          threatRecipientOverride: targetId,
        }
      }

      return { action: 'passthrough' }
    }

    if (event.type !== 'damage' || event.sourceID !== hunterId) {
      return { action: 'passthrough' }
    }

    if (event.tick) {
      return { action: 'passthrough' }
    }

    chargesRemaining -= 1

    if (chargesRemaining <= 0) {
      if (misdirectionAoeOverflowSpellIds.has(event.abilityGameID)) {
        redirectOverflowWindow = {
          abilityGameID: event.abilityGameID,
          timestamp: event.timestamp,
        }
      } else {
        ctx.uninstall()
      }
    }

    if (!ctx.actors.isActorAlive({ id: targetId })) {
      return { action: 'passthrough' }
    }

    return {
      action: 'augment',
      threatRecipientOverride: targetId,
    }
  }
}

export const hunterConfig: ClassThreatConfig = {
  ...eraHunterConfig,

  abilities: {
    ...eraHunterConfig.abilities,
    [Spells.PetScreechR5]: threatOnDebuffOrDamage(210),
    [Spells.DistractingShotR7]: threat({ bonus: 900, eventTypes: ['cast'] }),
    [Spells.Misdirection]: (ctx) => ({
      value: 0,
      splitAmongEnemies: false,
      note: 'misdirection(installInterceptor)',
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
}
