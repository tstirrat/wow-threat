/**
 * Processor that infers initial Salvation auras from early fight events.
 */
import type { WCLEvent } from '@wow-threat/wcl-types'

import {
  type FightProcessorFactory,
  addInitialAuraAddition,
} from '../event-processors'
import { salvationInferenceMetadataKey } from './keys'

const BLESSING_OF_SALVATION_ID = 1038
const GREATER_BLESSING_OF_SALVATION_ID = 25895
const SALVATION_AURA_IDS = new Set([
  BLESSING_OF_SALVATION_ID,
  GREATER_BLESSING_OF_SALVATION_ID,
])

type SalvationEventType = 'applybuff' | 'refreshbuff' | 'removebuff'

function resolveFightFriendlyPlayerIds(
  fightFriendlyPlayers: readonly number[] | undefined,
): Set<number> {
  return new Set(fightFriendlyPlayers ?? [])
}

/**
 * Infer start-of-fight Salvation aura seeds from first observed event type.
 */
export const createInferInitialSalvationProcessor: FightProcessorFactory = ({
  fight,
}) => {
  const friendlyPlayerIds = resolveFightFriendlyPlayerIds(
    fight?.friendlyPlayers,
  )
  if (friendlyPlayerIds.size === 0) {
    return null
  }

  const combatantInfoMinorSalvationPlayerIds = new Set<number>()
  const minorSalvationRemovedPlayerIds = new Set<number>()
  const inferredAurasByActor = new Map<number, Set<number>>()
  const firstSeenSalvationEventTypeByActorAndAura = new Map<
    number,
    Map<number, SalvationEventType>
  >()

  const recordFirstSeenEvent = (event: WCLEvent): void => {
    if (
      (event.type !== 'applybuff' &&
        event.type !== 'refreshbuff' &&
        event.type !== 'removebuff') ||
      !friendlyPlayerIds.has(event.targetID) ||
      !SALVATION_AURA_IDS.has(event.abilityGameID)
    ) {
      return
    }

    const actorFirstSeenEvents =
      firstSeenSalvationEventTypeByActorAndAura.get(event.targetID) ??
      new Map<number, SalvationEventType>()
    if (actorFirstSeenEvents.has(event.abilityGameID)) {
      return
    }

    actorFirstSeenEvents.set(event.abilityGameID, event.type)
    firstSeenSalvationEventTypeByActorAndAura.set(
      event.targetID,
      actorFirstSeenEvents,
    )

    if (event.type === 'applybuff') {
      return
    }

    const inferredAuraIds =
      inferredAurasByActor.get(event.targetID) ?? new Set()
    inferredAuraIds.add(event.abilityGameID)
    inferredAurasByActor.set(event.targetID, inferredAuraIds)
  }

  return {
    id: 'engine/infer-initial-salvation',
    visitPrepass(event) {
      if (
        event.type === 'combatantinfo' &&
        friendlyPlayerIds.has(event.sourceID) &&
        (event.auras ?? []).some(
          (aura) => aura.ability === BLESSING_OF_SALVATION_ID,
        )
      ) {
        combatantInfoMinorSalvationPlayerIds.add(event.sourceID)
        return
      }

      if (
        event.type === 'removebuff' &&
        event.abilityGameID === BLESSING_OF_SALVATION_ID &&
        friendlyPlayerIds.has(event.targetID)
      ) {
        minorSalvationRemovedPlayerIds.add(event.targetID)
      }

      recordFirstSeenEvent(event)
    },
    finalizePrepass(ctx) {
      inferredAurasByActor.forEach((auraIds, actorId) => {
        auraIds.forEach((auraId) => {
          addInitialAuraAddition(ctx.namespace, actorId, auraId)
        })
      })

      ctx.namespace.set(salvationInferenceMetadataKey, {
        combatantInfoMinorSalvationPlayerIds,
        minorSalvationRemovedPlayerIds,
      })
    },
  }
}
