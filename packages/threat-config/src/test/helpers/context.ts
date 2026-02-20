/**
 * Shared context helpers for SoD tests.
 */
import {
  createApplyDebuffEvent,
  createCastEvent,
  createDamageEvent,
  createMockActorContext,
} from '@wcl-threat/shared'
import type { ThreatContext } from '@wcl-threat/shared/src/types'
import type {
  ApplyDebuffEvent,
  CastEvent,
  DamageEvent,
  WCLEvent,
} from '@wcl-threat/wcl-types'

type LegacyFriendlyFlagOverrides = {
  sourceIsFriendly?: boolean
  targetIsFriendly?: boolean
}

type EventOverrides<TEvent> = Partial<TEvent> & LegacyFriendlyFlagOverrides

export function createContext(
  event: ThreatContext['event'],
  sourceAuras: Set<number> = new Set(),
): ThreatContext {
  return {
    event,
    amount: eventHasAmount(event) ? 100 : 0,
    sourceAuras,
    targetAuras: new Set(),
    sourceActor: { id: event.sourceID, name: 'Source', class: 'warrior' },
    targetActor: { id: event.targetID, name: 'Target', class: null },
    encounterId: null,
    spellSchoolMask: 0,
    actors: createMockActorContext(),
  }
}

function eventHasAmount(event: WCLEvent) {
  return (
    event.type === 'damage' ||
    event.type === 'heal' ||
    event.type === 'resourcechange' ||
    event.type === 'absorbed' ||
    event.type === 'energize'
  )
}

export function createDamageContext(
  overrides: EventOverrides<DamageEvent> = {},
  sourceAuras: Set<number> = new Set(),
): ThreatContext {
  return createContext(createDamageEvent(overrides), sourceAuras)
}

export function createCastContext(
  overrides: EventOverrides<CastEvent> = {},
  sourceAuras: Set<number> = new Set(),
): ThreatContext {
  return createContext(createCastEvent(overrides), sourceAuras)
}

export function createApplyDebuffContext(
  overrides: EventOverrides<ApplyDebuffEvent> = {},
  sourceAuras: Set<number> = new Set(),
): ThreatContext {
  return createContext(createApplyDebuffEvent(overrides), sourceAuras)
}
