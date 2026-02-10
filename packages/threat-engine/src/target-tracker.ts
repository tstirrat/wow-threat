/**
 * Target Tracker
 *
 * Tracks the current and previous target for each actor. Target references are
 * stored with enemy instance data so multi-instance mechanics can distinguish
 * otherwise identical enemy IDs.
 */
import type { ActorReference, ActorKey } from './instance-refs'
import { buildActorKey } from './instance-refs'

export interface TargetReference {
  targetId: number
  targetInstance: number
}

export class TargetTracker {
  private currentTargets = new Map<ActorKey, TargetReference>()
  private lastTargets = new Map<ActorKey, TargetReference>()

  /** Set a new current target for an actor and preserve the previous target. */
  setTarget(actor: ActorReference, target: TargetReference): void {
    const actorKey = buildActorKey(actor)
    const previousTarget = this.currentTargets.get(actorKey)
    if (
      previousTarget &&
      (previousTarget.targetId !== target.targetId ||
        previousTarget.targetInstance !== target.targetInstance)
    ) {
      this.lastTargets.set(actorKey, previousTarget)
    }

    this.currentTargets.set(actorKey, target)
  }

  /** Get an actor's current target reference, if any. */
  getCurrentTarget(actor: ActorReference): TargetReference | null {
    const actorKey = buildActorKey(actor)
    return this.currentTargets.get(actorKey) ?? null
  }

  /** Get an actor's previous target reference, if any. */
  getLastTarget(actor: ActorReference): TargetReference | null {
    const actorKey = buildActorKey(actor)
    return this.lastTargets.get(actorKey) ?? null
  }
}
