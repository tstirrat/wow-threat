/**
 * Processor that infers initial buff auras from early fight events.
 */
import type { ReportFight, WCLEvent } from '@wow-threat/wcl-types'

import {
  type FightProcessorFactory,
  addInitialAuraAddition,
} from '../event-processors'

type BuffEventType = 'applybuff' | 'refreshbuff' | 'removebuff'

function resolveFightFriendlyActorIds(
  fight: ReportFight | null | undefined,
): Set<number> {
  return new Set([
    ...(fight?.friendlyPlayers ?? []),
    ...(fight?.friendlyPets ?? []).map((pet) => pet.id),
  ])
}

function getOrCreateActorAuraSet(
  auraIdsByActor: Map<number, Set<number>>,
  actorId: number,
): Set<number> {
  const actorAuraIds = auraIdsByActor.get(actorId) ?? new Set<number>()
  auraIdsByActor.set(actorId, actorAuraIds)
  return actorAuraIds
}

function isBuffEvent(
  event: WCLEvent,
): event is WCLEvent & { type: BuffEventType } {
  return (
    event.type === 'applybuff' ||
    event.type === 'refreshbuff' ||
    event.type === 'removebuff'
  )
}

/**
 * Infer start-of-fight buff aura seeds from first observed event type.
 */
export const createInferInitialBuffsProcessor: FightProcessorFactory = ({
  fight,
}) => {
  const friendlyActorIds = resolveFightFriendlyActorIds(fight)
  if (friendlyActorIds.size === 0) {
    return null
  }

  const knownInitialAuraIdsByActor = new Map<number, Set<number>>()
  const combatantInfoAuraIdsByActor = new Map<number, Set<number>>()
  const firstSeenBuffEventTypeByActorAndAura = new Map<
    number,
    Map<number, BuffEventType>
  >()

  return {
    id: 'engine/infer-initial-buffs',
    init(ctx) {
      ctx.initialAurasByActor.forEach((initialAuraIds, actorId) => {
        if (!friendlyActorIds.has(actorId)) {
          return
        }

        const knownActorAuraIds = getOrCreateActorAuraSet(
          knownInitialAuraIdsByActor,
          actorId,
        )
        initialAuraIds.forEach((auraId) => knownActorAuraIds.add(auraId))
      })
    },
    visitPrepass(event) {
      if (
        event.type === 'combatantinfo' &&
        friendlyActorIds.has(event.sourceID)
      ) {
        const knownActorAuraIds = getOrCreateActorAuraSet(
          knownInitialAuraIdsByActor,
          event.sourceID,
        )
        const combatantInfoAuraIds = getOrCreateActorAuraSet(
          combatantInfoAuraIdsByActor,
          event.sourceID,
        )
        const combatantAuraIds = (event.auras ?? [])
          .map((aura) => aura.ability)
          .filter((auraId): auraId is number => auraId !== undefined)
        combatantAuraIds.forEach((auraId) => {
          knownActorAuraIds.add(auraId)
          combatantInfoAuraIds.add(auraId)
        })

        return
      }

      if (!isBuffEvent(event) || !friendlyActorIds.has(event.targetID)) {
        return
      }

      const actorFirstSeenEvents =
        firstSeenBuffEventTypeByActorAndAura.get(event.targetID) ??
        new Map<number, BuffEventType>()
      if (actorFirstSeenEvents.has(event.abilityGameID)) {
        return
      }

      actorFirstSeenEvents.set(event.abilityGameID, event.type)
      firstSeenBuffEventTypeByActorAndAura.set(
        event.targetID,
        actorFirstSeenEvents,
      )
    },
    finalizePrepass(ctx) {
      combatantInfoAuraIdsByActor.forEach((auraIds, actorId) => {
        auraIds.forEach((auraId) => {
          addInitialAuraAddition(ctx.namespace, actorId, auraId)
        })
      })

      firstSeenBuffEventTypeByActorAndAura.forEach(
        (firstSeenEventTypeByAura, actorId) => {
          const knownInitialAuraIds = knownInitialAuraIdsByActor.get(actorId)
          firstSeenEventTypeByAura.forEach((firstSeenEventType, auraId) => {
            if (firstSeenEventType === 'applybuff') {
              return
            }
            if (knownInitialAuraIds?.has(auraId)) {
              return
            }

            addInitialAuraAddition(ctx.namespace, actorId, auraId)
          })
        },
      )
    },
  }
}
