/**
 * Blackwing Lair Boss Abilities Tests
 */
import {
  checkExists,
  createApplyDebuffEvent,
  createDamageEvent,
  createMockActorContext,
  createRemoveDebuffEvent,
} from '@wow-threat/shared'
import type { EventInterceptorContext, ThreatContext } from '@wow-threat/shared'
import type { WCLEvent } from '@wow-threat/wcl-types'
import { describe, expect, it, vi } from 'vitest'

import { Spells as DruidSpells } from '../classes/druid'
import { Spells as WarriorSpells } from '../classes/warrior'
import { Spells, bwlAbilities } from './bwl'

function createClassCallApplyDebuffEvent(
  abilityGameID: number,
  targetID: number,
): ThreatContext['event'] {
  return createApplyDebuffEvent({
    timestamp: 1000,
    sourceID: 11583,
    sourceIsFriendly: false,
    sourceInstance: 0,
    targetID,
    targetIsFriendly: true,
    targetInstance: 0,
    abilityGameID,
  })
}

function createContext(
  event: ThreatContext['event'],
  targetAuras: Set<number> = new Set(),
): ThreatContext {
  return {
    event,
    amount: 0,
    sourceAuras: new Set(),
    targetAuras,
    sourceActor: { id: event.sourceID, name: 'Nefarian', class: null },
    targetActor: { id: event.targetID, name: 'Target', class: 'warrior' },
    encounterId: null,
    spellSchoolMask: 0,
    actors: createMockActorContext(),
  }
}

function createInterceptorContext(
  overrides: Partial<EventInterceptorContext> = {},
): {
  ctx: EventInterceptorContext
  uninstall: ReturnType<typeof vi.fn>
  setAura: ReturnType<typeof vi.fn>
  removeAura: ReturnType<typeof vi.fn>
} {
  const uninstall = vi.fn()
  const setAura = vi.fn()
  const removeAura = vi.fn()

  return {
    ctx: {
      timestamp: 2000,
      installedAt: 1000,
      actors: createMockActorContext(),
      uninstall,
      setAura,
      removeAura,
      ...overrides,
    },
    uninstall,
    setAura,
    removeAura,
  }
}

describe('bwlAbilities', () => {
  it('applies broodlord knock away as a 0.5 threat modifier on successful hits', () => {
    const formula = checkExists(bwlAbilities[Spells.BroodlordKnockAway])

    const result = checkExists(
      formula(
        createContext(
          createDamageEvent({
            timestamp: 1500,
            sourceID: 12017,
            sourceIsFriendly: false,
            sourceInstance: 0,
            targetID: 1,
            targetIsFriendly: true,
            targetInstance: 0,
            abilityGameID: Spells.BroodlordKnockAway,
            amount: 0,
          }),
        ),
      ),
    )

    expect(result.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0.5,
      target: 'target',
    })
  })

  it('installs a warrior class-call interceptor and forces berserker stance', () => {
    const formula = checkExists(bwlAbilities[Spells.NefarianWarriorClassCall])
    const result = checkExists(
      formula(createContext(createClassCallApplyDebuffEvent(23397, 2))),
    )

    expect(result.effects?.[0]?.type).toBe('installInterceptor')
    if (result.effects?.[0]?.type !== 'installInterceptor') {
      throw new Error('Expected installInterceptor effect')
    }

    const { ctx, setAura } = createInterceptorContext()
    const warriorDamageEvent: WCLEvent = createDamageEvent({
      timestamp: 2100,
      sourceID: 2,
      sourceIsFriendly: true,
      sourceInstance: 0,
      targetID: 11583,
      targetIsFriendly: false,
      targetInstance: 0,
      abilityGameID: 23922,
      amount: 100,
    })

    const interceptorResult = result.effects[0].interceptor(
      warriorDamageEvent,
      ctx,
    )
    expect(interceptorResult).toEqual({ action: 'passthrough' })
    expect(setAura).toHaveBeenCalledWith(2, WarriorSpells.BerserkerStance)
  })

  it('removes forced warrior stance when class call ends if aura was not already active', () => {
    const formula = checkExists(bwlAbilities[Spells.NefarianWarriorClassCall])
    const result = checkExists(
      formula(createContext(createClassCallApplyDebuffEvent(23397, 2))),
    )

    if (result.effects?.[0]?.type !== 'installInterceptor') {
      throw new Error('Expected installInterceptor effect')
    }

    const { ctx, uninstall, removeAura } = createInterceptorContext()
    const removeDebuffEvent: WCLEvent = createRemoveDebuffEvent({
      timestamp: 32000,
      sourceID: 11583,
      sourceIsFriendly: false,
      sourceInstance: 0,
      targetID: 2,
      targetIsFriendly: true,
      targetInstance: 0,
      abilityGameID: 23397,
    })

    result.effects[0].interceptor(removeDebuffEvent, ctx)

    expect(removeAura).toHaveBeenCalledWith(2, WarriorSpells.BerserkerStance)
    expect(uninstall).toHaveBeenCalledTimes(1)
  })

  it('does not remove pre-existing warrior stance when class call ends', () => {
    const formula = checkExists(bwlAbilities[Spells.NefarianWarriorClassCall])
    const result = checkExists(
      formula(
        createContext(
          createClassCallApplyDebuffEvent(23397, 2),
          new Set([WarriorSpells.BerserkerStance]),
        ),
      ),
    )

    if (result.effects?.[0]?.type !== 'installInterceptor') {
      throw new Error('Expected installInterceptor effect')
    }

    const { ctx, removeAura } = createInterceptorContext()
    const removeDebuffEvent: WCLEvent = createRemoveDebuffEvent({
      timestamp: 32000,
      sourceID: 11583,
      sourceIsFriendly: false,
      sourceInstance: 0,
      targetID: 2,
      targetIsFriendly: true,
      targetInstance: 0,
      abilityGameID: 23397,
    })

    result.effects[0].interceptor(removeDebuffEvent, ctx)

    expect(removeAura).not.toHaveBeenCalled()
  })

  it('forces cat form during druid class call', () => {
    const formula = checkExists(bwlAbilities[Spells.NefarianDruidClassCall])
    const result = checkExists(
      formula(createContext(createClassCallApplyDebuffEvent(23398, 4))),
    )

    if (result.effects?.[0]?.type !== 'installInterceptor') {
      throw new Error('Expected installInterceptor effect')
    }

    const { ctx, setAura } = createInterceptorContext()
    const druidDamageEvent: WCLEvent = createDamageEvent({
      timestamp: 2100,
      sourceID: 4,
      sourceIsFriendly: true,
      sourceInstance: 0,
      targetID: 11583,
      targetIsFriendly: false,
      targetInstance: 0,
      abilityGameID: 9896,
      amount: 100,
    })

    result.effects[0].interceptor(druidDamageEvent, ctx)

    expect(setAura).toHaveBeenCalledWith(4, DruidSpells.CatForm)
  })
})
