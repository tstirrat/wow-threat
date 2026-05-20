/**
 * Shared utilities for fight processor implementations.
 */
import type { ActorId } from '../instance-refs'

/** Return the runtime friendly actor set when populated, otherwise fall back to the fight-level set. */
export function resolveFriendlyActorIds(
  fightFriendlyActorIds: Set<ActorId>,
  runtimeFriendlyActorIds: Set<ActorId> | undefined,
): Set<ActorId> {
  if (runtimeFriendlyActorIds && runtimeFriendlyActorIds.size > 0) {
    return runtimeFriendlyActorIds
  }

  return fightFriendlyActorIds
}
