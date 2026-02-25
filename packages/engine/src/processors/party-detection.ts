/**
 * Processor that infers raid party membership from party-scoped spell events.
 */
import type { Actor } from '@wow-threat/shared'
import type { Report, ReportFight, WCLEvent } from '@wow-threat/wcl-types'

import {
  type FightProcessorFactory,
  createProcessorDataKey,
} from '../event-processors'
import type { ActorId } from '../instance-refs'

const MAX_INFERRED_PARTY_MEMBERS = 5
export type GroupId = number

type PartySignalEvent = Extract<
  WCLEvent,
  {
    type: 'heal' | 'applybuff' | 'refreshbuff' | 'applybuffstack'
  }
>

interface PartySignalDefinition {
  fallbackSpellIds: readonly number[]
  eventTypes: ReadonlySet<PartySignalEvent['type']>
  matchName: (normalizedName: string) => boolean
}

interface PartySignalObservation {
  sourceActorId: ActorId
  targetActorIds: Set<ActorId>
}

interface DisjointSet {
  find: (actorId: ActorId) => ActorId
  canMerge: (actorIds: ActorId[]) => boolean
  union: (leftActorId: ActorId, rightActorId: ActorId) => void
}

export interface PartyAssignments {
  actorGroupById: Map<ActorId, GroupId>
  membersByGroupId: Map<GroupId, Set<ActorId>>
}

const PARTY_SIGNAL_DEFINITIONS: readonly PartySignalDefinition[] = [
  {
    fallbackSpellIds: [596, 996, 10960, 10961, 25316],
    eventTypes: new Set(['heal']),
    matchName: (normalizedName) => normalizedName.includes('prayer of healing'),
  },
  {
    fallbackSpellIds: [
      1243, 1244, 1245, 2791, 10937, 10938, 21562, 21564, 25392,
    ],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) =>
      normalizedName.includes('prayer of fortitude'),
  },
  {
    fallbackSpellIds: [34861, 34863, 34864, 34865, 34866, 401946],
    eventTypes: new Set(['heal']),
    matchName: (normalizedName) => normalizedName.includes('circle of healing'),
  },
  {
    fallbackSpellIds: [27801, 25331],
    eventTypes: new Set(['heal']),
    matchName: (normalizedName) => normalizedName.includes('holy nova'),
  },
  {
    fallbackSpellIds: [19746],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) =>
      normalizedName.includes('concentration aura'),
  },
  {
    fallbackSpellIds: [465, 643, 1032, 10290, 10291, 10292, 10293],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) => normalizedName.includes('devotion aura'),
  },
  {
    fallbackSpellIds: [7294, 10298, 10299, 10300, 10301],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) => normalizedName.includes('retribution aura'),
  },
  {
    fallbackSpellIds: [19876, 19895, 19896],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) =>
      normalizedName.includes('shadow resistance aura'),
  },
  {
    fallbackSpellIds: [19888, 19897, 19898],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) =>
      normalizedName.includes('frost resistance aura'),
  },
  {
    fallbackSpellIds: [19891, 19899, 19900],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) =>
      normalizedName.includes('fire resistance aura'),
  },
  {
    fallbackSpellIds: [20218],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) => normalizedName.includes('sanctity aura'),
  },
  {
    fallbackSpellIds: [24858, 24907],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) => normalizedName.includes('moonkin aura'),
  },
  {
    fallbackSpellIds: [19506, 20905, 20906, 27066],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) => normalizedName.includes('trueshot aura'),
  },
  {
    fallbackSpellIds: [17007, 24932],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) =>
      normalizedName.includes('leader of the pack'),
  },
  {
    fallbackSpellIds: [33891, 439745],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) => normalizedName.includes('tree of life'),
  },
  {
    fallbackSpellIds: [30807],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) => normalizedName.includes('unleashed rage'),
  },
  {
    fallbackSpellIds: [2825, 32182],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) =>
      normalizedName.includes('bloodlust') ||
      normalizedName.includes('heroism'),
  },
  {
    fallbackSpellIds: [27045],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) =>
      normalizedName.includes('aspect of the wild'),
  },
  {
    fallbackSpellIds: [13159],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) =>
      normalizedName.includes('aspect of the pack'),
  },
  {
    fallbackSpellIds: [6673, 5242, 6192, 11549, 11550, 11551, 25289],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) => normalizedName.includes('battle shout'),
  },
  {
    fallbackSpellIds: [469, 47439, 403215],
    eventTypes: new Set(['applybuff', 'refreshbuff', 'applybuffstack']),
    matchName: (normalizedName) => normalizedName.includes('commanding shout'),
  },
]

export const partyAssignmentsKey = createProcessorDataKey<PartyAssignments>(
  'engine:party-assignments',
)

function normalizeSpellName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(rank \d+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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

function resolveFriendlyPlayerIds(
  fight: ReportFight | null | undefined,
  friendlyActorIds: Set<ActorId>,
  actorMap: Map<number, Actor>,
): Set<ActorId> {
  if ((fight?.friendlyPlayers ?? []).length > 0) {
    return new Set(fight?.friendlyPlayers ?? [])
  }

  return new Set(
    [...friendlyActorIds].filter((actorId) => {
      const actor = actorMap.get(actorId)
      return actor?.petOwner === null || actor?.petOwner === undefined
    }),
  )
}

function resolveFriendlyPetIds(
  fight: ReportFight | null | undefined,
  friendlyActorIds: Set<ActorId>,
  actorMap: Map<number, Actor>,
): Set<ActorId> {
  if ((fight?.friendlyPets ?? []).length > 0) {
    return new Set((fight?.friendlyPets ?? []).map((pet) => pet.id))
  }

  return new Set(
    [...friendlyActorIds].filter((actorId) => {
      const actor = actorMap.get(actorId)
      return actor?.petOwner !== null && actor?.petOwner !== undefined
    }),
  )
}

function resolvePartySignalBySpellId(
  report: Report | null | undefined,
): Map<number, PartySignalDefinition> {
  const signalBySpellId = new Map<number, PartySignalDefinition>()

  PARTY_SIGNAL_DEFINITIONS.forEach((definition) => {
    definition.fallbackSpellIds.forEach((spellId) => {
      signalBySpellId.set(spellId, definition)
    })
  })
  ;(report?.masterData.abilities ?? []).forEach((ability) => {
    if (!ability?.name || ability.gameID === null) {
      return
    }

    const normalizedName = normalizeSpellName(ability.name)
    const matchingDefinition = PARTY_SIGNAL_DEFINITIONS.find((definition) =>
      definition.matchName(normalizedName),
    )
    if (!matchingDefinition) {
      return
    }

    signalBySpellId.set(ability.gameID, matchingDefinition)
  })

  return signalBySpellId
}

function isPartySignalEvent(
  event: WCLEvent,
  signalBySpellId: Map<number, PartySignalDefinition>,
): event is PartySignalEvent {
  if (!('abilityGameID' in event) || typeof event.abilityGameID !== 'number') {
    return false
  }

  if (!signalBySpellId.has(event.abilityGameID)) {
    return false
  }

  return (
    event.type === 'heal' ||
    event.type === 'applybuff' ||
    event.type === 'refreshbuff' ||
    event.type === 'applybuffstack'
  )
}

function createObservationKey(event: PartySignalEvent): string {
  return `${event.sourceID}:${event.sourceInstance ?? 0}:${event.abilityGameID}:${event.timestamp}`
}

function createDisjointSet(actorIds: ActorId[]): DisjointSet {
  const parentByActorId = new Map<ActorId, ActorId>(
    actorIds.map((actorId) => [actorId, actorId]),
  )
  const rankByActorId = new Map<ActorId, number>(
    actorIds.map((actorId) => [actorId, 0]),
  )
  const sizeByRootActorId = new Map<ActorId, number>(
    actorIds.map((actorId) => [actorId, 1]),
  )

  const find = (actorId: ActorId): ActorId => {
    const parentActorId = parentByActorId.get(actorId) ?? actorId
    if (parentActorId === actorId) {
      parentByActorId.set(actorId, actorId)
      return actorId
    }

    const rootActorId = find(parentActorId)
    parentByActorId.set(actorId, rootActorId)
    return rootActorId
  }

  const canMerge = (actorIdsToMerge: ActorId[]): boolean => {
    const uniqueRootIds = new Set(
      actorIdsToMerge.map((actorId) => find(actorId)),
    )
    const mergedSize = [...uniqueRootIds].reduce((sum, rootActorId) => {
      return sum + (sizeByRootActorId.get(rootActorId) ?? 1)
    }, 0)

    return mergedSize <= MAX_INFERRED_PARTY_MEMBERS
  }

  const union = (leftActorId: ActorId, rightActorId: ActorId): void => {
    const leftRoot = find(leftActorId)
    const rightRoot = find(rightActorId)
    if (leftRoot === rightRoot) {
      return
    }

    const leftSize = sizeByRootActorId.get(leftRoot) ?? 1
    const rightSize = sizeByRootActorId.get(rightRoot) ?? 1
    const leftRank = rankByActorId.get(leftRoot) ?? 0
    const rightRank = rankByActorId.get(rightRoot) ?? 0

    if (leftRank < rightRank) {
      parentByActorId.set(leftRoot, rightRoot)
      sizeByRootActorId.set(rightRoot, leftSize + rightSize)
      sizeByRootActorId.delete(leftRoot)
      return
    }

    if (leftRank > rightRank) {
      parentByActorId.set(rightRoot, leftRoot)
      sizeByRootActorId.set(leftRoot, leftSize + rightSize)
      sizeByRootActorId.delete(rightRoot)
      return
    }

    parentByActorId.set(rightRoot, leftRoot)
    sizeByRootActorId.set(leftRoot, leftSize + rightSize)
    sizeByRootActorId.delete(rightRoot)
    rankByActorId.set(leftRoot, leftRank + 1)
  }

  return {
    find,
    canMerge,
    union,
  }
}

function isFriendlyActor(
  actorId: ActorId,
  friendlyActorIds: Set<ActorId>,
): boolean {
  return friendlyActorIds.has(actorId)
}

function buildAssignmentsFromObservations({
  baseActorIds,
  completedObservations,
}: {
  baseActorIds: ActorId[]
  completedObservations: PartySignalObservation[]
}): PartyAssignments {
  const baseActorIdSet = new Set(baseActorIds)
  const actorGroupById = new Map<ActorId, GroupId>()
  const membersByGroupId = new Map<GroupId, Set<ActorId>>()
  const sortedBaseActorIds = [...baseActorIds].sort(
    (left, right) => left - right,
  )
  const disjointSet = createDisjointSet(sortedBaseActorIds)

  completedObservations.forEach((observation) => {
    const actorIds = [...observation.targetActorIds].filter((actorId) =>
      baseActorIdSet.has(actorId),
    )
    if (
      actorIds.length < 2 ||
      actorIds.length > MAX_INFERRED_PARTY_MEMBERS ||
      !disjointSet.canMerge(actorIds)
    ) {
      return
    }

    const [firstActorId, ...restActorIds] = actorIds
    if (firstActorId === undefined) {
      return
    }

    restActorIds.forEach((actorId) => {
      disjointSet.union(firstActorId, actorId)
    })
  })

  const membersByRoot = sortedBaseActorIds.reduce((result, actorId) => {
    const rootActorId = disjointSet.find(actorId)
    const members = result.get(rootActorId) ?? new Set<ActorId>()
    members.add(actorId)
    result.set(rootActorId, members)
    return result
  }, new Map<ActorId, Set<ActorId>>())

  const sortedGroups = [...membersByRoot.values()].sort((left, right) => {
    const leftMin = Math.min(...left)
    const rightMin = Math.min(...right)
    return leftMin - rightMin
  })

  sortedGroups.forEach((members, index) => {
    const groupId = (index + 1) as GroupId
    membersByGroupId.set(groupId, new Set(members))
    members.forEach((actorId) => {
      actorGroupById.set(actorId, groupId)
    })
  })

  return {
    actorGroupById,
    membersByGroupId,
  }
}

/**
 * Infer party group membership using party-restricted spell hit patterns.
 */
export const createPartyDetectionProcessor: FightProcessorFactory = ({
  report,
  fight,
  inferThreatReduction,
}) => {
  if (!inferThreatReduction) {
    return null
  }

  const signalBySpellId = resolvePartySignalBySpellId(report)
  const fightFriendlyActorIds = resolveFightFriendlyActorIds(fight)
  const observationsByKey = new Map<string, PartySignalObservation>()

  return {
    id: 'engine/party-detection',
    visitPrepass(event, ctx) {
      if (!isPartySignalEvent(event, signalBySpellId)) {
        return
      }

      const signal = signalBySpellId.get(event.abilityGameID)
      if (!signal || !signal.eventTypes.has(event.type)) {
        return
      }

      const friendlyActorIds = resolveFriendlyActorIds(
        fightFriendlyActorIds,
        ctx.friendlyActorIds,
      )
      if (!isFriendlyActor(event.targetID, friendlyActorIds)) {
        return
      }

      const observationKey = createObservationKey(event)
      const observation = observationsByKey.get(observationKey)
      if (observation) {
        observation.targetActorIds.add(event.targetID)
        return
      }

      observationsByKey.set(observationKey, {
        sourceActorId: event.sourceID,
        targetActorIds: new Set<ActorId>([event.targetID]),
      })
    },
    finalizePrepass(ctx) {
      const completedObservations = [...observationsByKey.values()].filter(
        (observation) =>
          observation.targetActorIds.size >= 2 &&
          observation.targetActorIds.size <= MAX_INFERRED_PARTY_MEMBERS,
      )
      observationsByKey.clear()

      const friendlyActorIds = resolveFriendlyActorIds(
        fightFriendlyActorIds,
        ctx.friendlyActorIds,
      )
      if (friendlyActorIds.size === 0) {
        return
      }

      const friendlyPlayerIds = resolveFriendlyPlayerIds(
        fight,
        friendlyActorIds,
        ctx.actorMap,
      )
      const baseActorIds =
        friendlyPlayerIds.size > 0
          ? [...friendlyPlayerIds]
          : [...friendlyActorIds]
      if (baseActorIds.length === 0) {
        return
      }

      const assignments = buildAssignmentsFromObservations({
        baseActorIds,
        completedObservations,
      })

      const friendlyPetIds = resolveFriendlyPetIds(
        fight,
        friendlyActorIds,
        ctx.actorMap,
      )
      friendlyPetIds.forEach((petActorId) => {
        const petOwnerId = ctx.actorMap.get(petActorId)?.petOwner
        if (petOwnerId === null || petOwnerId === undefined) {
          return
        }

        const ownerGroupId = assignments.actorGroupById.get(petOwnerId)
        if (!ownerGroupId) {
          return
        }

        assignments.actorGroupById.set(petActorId, ownerGroupId)
        const members = assignments.membersByGroupId.get(ownerGroupId)
        members?.add(petActorId)
      })

      const unassignedFriendlyActorIds = [...friendlyActorIds]
        .filter((actorId) => !assignments.actorGroupById.has(actorId))
        .sort((left, right) => left - right)

      let nextGroupId = (assignments.membersByGroupId.size + 1) as GroupId
      unassignedFriendlyActorIds.forEach((actorId) => {
        assignments.actorGroupById.set(actorId, nextGroupId)
        assignments.membersByGroupId.set(nextGroupId, new Set([actorId]))
        nextGroupId = (nextGroupId + 1) as GroupId
      })

      ctx.namespace.set(partyAssignmentsKey, assignments)
    },
  }
}
