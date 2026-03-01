/**
 * Blackwing Lair Boss Abilities
 *
 * Shared BWL threat mechanics for Era-derived configurations.
 */
import type {
  EventInterceptor,
  SpellId,
  ThreatFormula,
} from '@wow-threat/shared'
import type { EventType, WCLEvent } from '@wow-threat/wcl-types'

import { modifyThreat, modifyThreatOnHit } from '../../shared/formulas'
import { Spells as DruidSpells } from '../classes/druid'
import { Spells as WarriorSpells } from '../classes/warrior'

const CLASS_CALL_START_EVENT_TYPES: EventType[] = ['applydebuff']

export const Spells = {
  BroodlordKnockAway: 18670, // https://www.wowhead.com/classic/spell=18670/
  WingBuffet: 23339, // https://www.wowhead.com/classic/spell=23339/
  NefarianWarriorClassCall: 23397, // https://www.wowhead.com/classic/spell=23397/
  NefarianDruidClassCall: 23398, // https://www.wowhead.com/classic/spell=23398/
  TimeLapse1: 23310, // https://www.wowhead.com/classic/spell=23310/
  TimeLapse2: 23311, // https://www.wowhead.com/classic/spell=23311/
  TimeLapse3: 23312, // https://www.wowhead.com/classic/spell=23312/
  RazorgoreConflagrate: 23023, // https://www.wowhead.com/classic/spell=23023/
  BroodPowerGreen: 22289, // https://www.wowhead.com/classic/spell=22289/
  NefarianWildPolymorph: 23603, // https://www.wowhead.com/classic/spell=23603/
} as const

/**
 * Aggro-loss buffs from Blackwing Lair bosses.
 */
export const bwlAggroLossBuffs: ReadonlySet<SpellId> = new Set([
  Spells.RazorgoreConflagrate,
  Spells.TimeLapse1,
  Spells.TimeLapse2,
  Spells.TimeLapse3,
  Spells.BroodPowerGreen,
  Spells.NefarianWildPolymorph,
])

interface ForceAuraClassCallOptions {
  classCallSpellId: SpellId
  forcedAuraId: SpellId
  forcedAuraName: string
}

function isClassCallEndEvent(
  event: WCLEvent,
  classCallSpellId: SpellId,
  targetId: number,
): boolean {
  if (!('abilityGameID' in event)) {
    return false
  }
  if (event.abilityGameID !== classCallSpellId || event.targetID !== targetId) {
    return false
  }
  if (event.type === 'removedebuff') {
    return true
  }
  if (event.type === 'removedebuffstack') {
    return event.stacks === undefined || event.stacks <= 0
  }
  return false
}

function createForcedAuraClassCallInterceptor(
  classCallSpellId: SpellId,
  targetId: number,
  forcedAuraId: SpellId,
  shouldRemoveForcedAuraOnEnd: boolean,
): EventInterceptor {
  return (event, interceptorCtx) => {
    if (isClassCallEndEvent(event, classCallSpellId, targetId)) {
      if (shouldRemoveForcedAuraOnEnd) {
        interceptorCtx.removeAura(targetId, forcedAuraId)
      }
      interceptorCtx.uninstall()
      return { action: 'passthrough' }
    }

    interceptorCtx.setAura(targetId, forcedAuraId)
    return { action: 'passthrough' }
  }
}

function forceAuraDuringClassCall(
  options: ForceAuraClassCallOptions,
): ThreatFormula {
  return (ctx) => {
    if (!CLASS_CALL_START_EVENT_TYPES.includes(ctx.event.type)) {
      return undefined
    }

    const targetId = ctx.event.targetID
    const auraAlreadyActive = ctx.targetAuras.has(options.forcedAuraId)

    return {
      value: 0,
      splitAmongEnemies: false,
      note: `classCall(${options.forcedAuraName})`,
      effects: [
        {
          type: 'installInterceptor',
          interceptor: createForcedAuraClassCallInterceptor(
            options.classCallSpellId,
            targetId,
            options.forcedAuraId,
            !auraAlreadyActive,
          ),
        },
      ],
    }
  }
}

export const bwlAbilities: Record<SpellId, ThreatFormula> = {
  [Spells.BroodlordKnockAway]: modifyThreatOnHit(0.5),
  [Spells.WingBuffet]: modifyThreatOnHit(0.5),
  [Spells.NefarianWarriorClassCall]: forceAuraDuringClassCall({
    classCallSpellId: Spells.NefarianWarriorClassCall,
    forcedAuraId: WarriorSpells.BerserkerStance,
    forcedAuraName: 'Berserker Stance',
  }),
  [Spells.NefarianDruidClassCall]: forceAuraDuringClassCall({
    classCallSpellId: Spells.NefarianDruidClassCall,
    forcedAuraId: DruidSpells.CatForm,
    forcedAuraName: 'Cat Form',
  }),
  [Spells.TimeLapse1]: modifyThreat({
    modifier: 0.5,
    eventTypes: ['applydebuff'],
  }),
  [Spells.TimeLapse2]: modifyThreat({
    modifier: 0.5,
    eventTypes: ['applydebuff'],
  }),
  [Spells.TimeLapse3]: modifyThreat({
    modifier: 0.5,
    eventTypes: ['applydebuff'],
  }),
}
