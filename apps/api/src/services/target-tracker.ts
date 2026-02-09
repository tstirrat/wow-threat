/**
 * Target Tracker
 *
 * Tracks the current and previous target for each actor. Target references are
 * stored with enemy instance data so multi-instance mechanics can distinguish
 * otherwise identical enemy IDs.
 */
export interface TargetReference {
  targetId: number
  targetInstance: number
}

export class TargetTracker {
  private currentTargets = new Map<number, TargetReference>()
  private lastTargets = new Map<number, TargetReference>()

  /** Set a new current target for an actor and preserve the previous target. */
  setTarget(actorId: number, target: TargetReference): void {
    const previousTarget = this.currentTargets.get(actorId)
    if (
      previousTarget &&
      (previousTarget.targetId !== target.targetId ||
        previousTarget.targetInstance !== target.targetInstance)
    ) {
      this.lastTargets.set(actorId, previousTarget)
    }

    this.currentTargets.set(actorId, target)
  }

  /** Get an actor's current target reference, if any. */
  getCurrentTarget(actorId: number): TargetReference | null {
    return this.currentTargets.get(actorId) ?? null
  }

  /** Get an actor's previous target reference, if any. */
  getLastTarget(actorId: number): TargetReference | null {
    return this.lastTargets.get(actorId) ?? null
  }
}
