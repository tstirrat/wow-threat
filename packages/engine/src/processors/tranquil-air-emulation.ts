/**
 * Processor that emulates Tranquil Air Totem party aura application by range.
 */
import type { Actor } from '@wow-threat/shared'
import type { ReportFight, WCLEvent } from '@wow-threat/wcl-types'

import type {
  FightProcessorFactory,
  MainPassEventContext,
} from '../event-processors'
import type { ActorId } from '../instance-refs'
import { partyAssignmentsKey } from './party-detection'

const TRANQUIL_AIR_TOTEM_SPELL_IDS = new Set<number>([25908])
const TRANQUIL_AIR_BUFF_SPELL_ID = 25909
const POSITION_UNITS_PER_YARD = 200
const TRANQUIL_AIR_RANGE_YARDS = 30
const TRANQUIL_AIR_RANGE_UNITS =
  POSITION_UNITS_PER_YARD * TRANQUIL_AIR_RANGE_YARDS
const CAST_POSITION_MAX_AGE_MS = 2000

interface XYPosition {
  x: number
  y: number
}

interface RecordedCastPosition {
  timestamp: number
  position: XYPosition
}

function resolveFightFriendlyActorIds(
  fight: ReportFight | null | undefined,
): Set<ActorId> {
  return new Set([
    ...(fight?.friendlyPlayers ?? []),
    ...(fight?.friendlyPets ?? []).map((pet) => pet.id),
  ])
}

function resolveFriendlyActorIds(
  fightFriendlyActorIds: Set<ActorId>,
  runtimeFriendlyActorIds: Set<ActorId> | undefined,
): Set<ActorId> {
  if (runtimeFriendlyActorIds && runtimeFriendlyActorIds.size > 0) {
    return runtimeFriendlyActorIds
  }

  return fightFriendlyActorIds
}

function resolveOwnedPetIdsForOwners(
  ownerActorIds: Set<ActorId>,
  actorMap: Map<number, Actor>,
  friendlyActorIds: Set<ActorId>,
): Set<ActorId> {
  return new Set(
    [...actorMap.values()]
      .filter((actor) => {
        if (actor.petOwner === null || actor.petOwner === undefined) {
          return false
        }
        if (!ownerActorIds.has(actor.petOwner)) {
          return false
        }
        if (friendlyActorIds.size === 0) {
          return true
        }
        return friendlyActorIds.has(actor.id)
      })
      .map((actor) => actor.id),
  )
}

function resolveCandidatePartyMemberIds(
  sourceActorId: ActorId,
  actorMap: Map<number, Actor>,
  friendlyActorIds: Set<ActorId>,
  ctx: MainPassEventContext,
): Set<ActorId> {
  const partyAssignments = ctx.namespace.get(partyAssignmentsKey)
  const candidateActorIds = new Set<ActorId>()
  const sourceGroupId = partyAssignments?.actorGroupById.get(sourceActorId)

  if (sourceGroupId !== undefined) {
    partyAssignments?.membersByGroupId
      .get(sourceGroupId)
      ?.forEach((actorId) => {
        candidateActorIds.add(actorId)
      })
  }

  candidateActorIds.add(sourceActorId)
  resolveOwnedPetIdsForOwners(
    candidateActorIds,
    actorMap,
    friendlyActorIds,
  ).forEach((petActorId) => {
    candidateActorIds.add(petActorId)
  })

  return new Set(
    [...candidateActorIds].filter((actorId) => {
      if (friendlyActorIds.size === 0) {
        return true
      }
      return friendlyActorIds.has(actorId)
    }),
  )
}

function buildSourceKey(
  actorId: ActorId,
  sourceInstance: number | undefined,
): string {
  return `${actorId}:${sourceInstance ?? 0}`
}

function resolveFallbackSummonPosition(
  event: WCLEvent,
  ctx: MainPassEventContext,
): XYPosition | null {
  return ctx.fightState.getPosition({
    id: event.sourceID,
    instanceId: event.sourceInstance,
  })
}

function resolveActorPosition(
  actorId: ActorId,
  actorMap: Map<number, Actor>,
  ctx: MainPassEventContext,
): XYPosition | null {
  const actorPosition = ctx.fightState.getPosition({
    id: actorId,
    instanceId: 0,
  })
  if (actorPosition) {
    return actorPosition
  }

  const ownerActorId = actorMap.get(actorId)?.petOwner
  if (ownerActorId === null || ownerActorId === undefined) {
    return null
  }

  return ctx.fightState.getPosition({
    id: ownerActorId,
    instanceId: 0,
  })
}

function calculateDistanceUnits(
  leftPosition: XYPosition,
  rightPosition: XYPosition,
): number {
  const dx = rightPosition.x - leftPosition.x
  const dy = rightPosition.y - leftPosition.y
  return Math.sqrt(dx * dx + dy * dy)
}

function calculateAddedAuraActorIds({
  previousRecipients,
  nextRecipients,
  actorSourceCountById,
}: {
  previousRecipients: Set<ActorId>
  nextRecipients: Set<ActorId>
  actorSourceCountById: Map<ActorId, number>
}): ActorId[] {
  return [...nextRecipients]
    .filter((actorId) => !previousRecipients.has(actorId))
    .flatMap((actorId) => {
      const previousSourceCount = actorSourceCountById.get(actorId) ?? 0
      actorSourceCountById.set(actorId, previousSourceCount + 1)
      return previousSourceCount === 0 ? [actorId] : []
    })
}

function calculateRemovedAuraActorIds({
  previousRecipients,
  nextRecipients,
  actorSourceCountById,
}: {
  previousRecipients: Set<ActorId>
  nextRecipients: Set<ActorId>
  actorSourceCountById: Map<ActorId, number>
}): ActorId[] {
  return [...previousRecipients]
    .filter((actorId) => !nextRecipients.has(actorId))
    .flatMap((actorId) => {
      const previousSourceCount = actorSourceCountById.get(actorId) ?? 0
      if (previousSourceCount <= 1) {
        actorSourceCountById.delete(actorId)
        return [actorId]
      }

      actorSourceCountById.set(actorId, previousSourceCount - 1)
      return []
    })
}

/**
 * Emulate Tranquil Air aura state by party assignment and summon-time distance.
 */
export const createTranquilAirEmulationProcessor: FightProcessorFactory = ({
  fight,
  inferThreatReduction,
}) => {
  if (!inferThreatReduction) {
    return null
  }

  const fightFriendlyActorIds = resolveFightFriendlyActorIds(fight)
  const recipientActorIdsByShamanId = new Map<ActorId, Set<ActorId>>()
  const actorSourceCountById = new Map<ActorId, number>()
  const castPositionBySourceKey = new Map<string, RecordedCastPosition>()

  return {
    id: 'engine/tranquil-air-emulation',
    beforeFightState(ctx) {
      const friendlyActorIds = resolveFriendlyActorIds(
        fightFriendlyActorIds,
        ctx.friendlyActorIds,
      )

      if (
        ctx.event.type === 'cast' &&
        TRANQUIL_AIR_TOTEM_SPELL_IDS.has(ctx.event.abilityGameID)
      ) {
        if (
          (friendlyActorIds.size === 0 ||
            friendlyActorIds.has(ctx.event.sourceID)) &&
          typeof ctx.event.x === 'number' &&
          typeof ctx.event.y === 'number'
        ) {
          castPositionBySourceKey.set(
            buildSourceKey(ctx.event.sourceID, ctx.event.sourceInstance),
            {
              timestamp: ctx.event.timestamp,
              position: {
                x: ctx.event.x,
                y: ctx.event.y,
              },
            },
          )
        }
        return
      }

      if (
        ctx.event.type !== 'summon' ||
        !TRANQUIL_AIR_TOTEM_SPELL_IDS.has(ctx.event.abilityGameID)
      ) {
        return
      }

      if (
        friendlyActorIds.size > 0 &&
        !friendlyActorIds.has(ctx.event.sourceID)
      ) {
        return
      }

      const previousRecipients =
        recipientActorIdsByShamanId.get(ctx.event.sourceID) ??
        new Set<ActorId>()
      const candidateActorIds = resolveCandidatePartyMemberIds(
        ctx.event.sourceID,
        ctx.actorMap,
        friendlyActorIds,
        ctx,
      )
      const sourceKey = buildSourceKey(
        ctx.event.sourceID,
        ctx.event.sourceInstance,
      )
      const recordedCastPosition = castPositionBySourceKey.get(sourceKey)
      castPositionBySourceKey.delete(sourceKey)
      const summonPosition =
        recordedCastPosition &&
        ctx.event.timestamp - recordedCastPosition.timestamp <=
          CAST_POSITION_MAX_AGE_MS
          ? recordedCastPosition.position
          : resolveFallbackSummonPosition(ctx.event, ctx)
      const selfAndOwnedPetActorIds = new Set<ActorId>([
        ctx.event.sourceID,
        ...resolveOwnedPetIdsForOwners(
          new Set([ctx.event.sourceID]),
          ctx.actorMap,
          friendlyActorIds,
        ),
      ])

      const nextRecipients =
        summonPosition === null
          ? new Set([...previousRecipients, ...selfAndOwnedPetActorIds])
          : new Set(
              [...candidateActorIds].filter((actorId) => {
                if (actorId === ctx.event.sourceID) {
                  return true
                }

                const actorPosition = resolveActorPosition(
                  actorId,
                  ctx.actorMap,
                  ctx,
                )
                if (!actorPosition) {
                  return false
                }

                return (
                  calculateDistanceUnits(summonPosition, actorPosition) <=
                  TRANQUIL_AIR_RANGE_UNITS
                )
              }),
            )

      const addedActorIds = calculateAddedAuraActorIds({
        previousRecipients,
        nextRecipients,
        actorSourceCountById,
      }).sort((left, right) => left - right)
      const removedActorIds = calculateRemovedAuraActorIds({
        previousRecipients,
        nextRecipients,
        actorSourceCountById,
      }).sort((left, right) => left - right)

      recipientActorIdsByShamanId.set(ctx.event.sourceID, nextRecipients)

      if (removedActorIds.length > 0) {
        ctx.addEffects({
          type: 'auraMutation',
          action: 'remove',
          spellId: TRANQUIL_AIR_BUFF_SPELL_ID,
          actorIds: removedActorIds,
        })
      }

      if (addedActorIds.length > 0) {
        ctx.addEffects({
          type: 'auraMutation',
          action: 'apply',
          spellId: TRANQUIL_AIR_BUFF_SPELL_ID,
          actorIds: addedActorIds,
        })
      }
    },
  }
}
