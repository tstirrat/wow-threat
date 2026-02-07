/**
 * Threat Tracker
 *
 * Tracks cumulative threat for each actor against each enemy throughout a fight.
 * Used for abilities that need to query threat state (e.g., Patchwerk's Hateful Strike).
 *
 * TODO: Track threat per enemy instance, not just per enemy ID.
 * Currently sums threat across all instances of the same enemy.
 * This affects fights with multiple copies of the same NPC.
 */

export class ThreatTracker {
  // Map: actorId -> Map: enemyId -> threat
  private threat = new Map<number, Map<number, number>>()

  /**
   * Add threat for an actor against an enemy
   */
  addThreat(actorId: number, enemyId: number, amount: number): void {
    if (!this.threat.has(actorId)) {
      this.threat.set(actorId, new Map())
    }
    const actorThreat = this.threat.get(actorId)!
    const current = actorThreat.get(enemyId) ?? 0
    actorThreat.set(enemyId, current + amount)
  }

  /**
   * Set threat for an actor against an enemy (replaces current value)
   * Clamps to minimum of 0
   */
  setThreat(actorId: number, enemyId: number, amount: number): void {
    const clampedAmount = Math.max(0, amount)
    if (!this.threat.has(actorId)) {
      this.threat.set(actorId, new Map())
    }
    const actorThreat = this.threat.get(actorId)!
    actorThreat.set(enemyId, clampedAmount)
  }

  /**
   * Get the current threat for an actor against an enemy
   */
  getThreat(actorId: number, enemyId: number): number {
    return this.threat.get(actorId)?.get(enemyId) ?? 0
  }

  /**
   * Get the top N actors by threat against a specific enemy
   * @returns Array of actors sorted by threat (highest first)
   */
  getTopActorsByThreat(
    enemyId: number,
    count: number,
  ): Array<{ actorId: number; threat: number }> {
    const actors: Array<{ actorId: number; threat: number }> = []

    for (const [actorId, actorThreat] of this.threat) {
      const threat = actorThreat.get(enemyId) ?? 0
      if (threat > 0) {
        actors.push({ actorId, threat })
      }
    }

    actors.sort((a, b) => b.threat - a.threat)
    return actors.slice(0, count)
  }

  /**
   * Get all actor threat values for a specific enemy
   */
  getAllActorThreat(enemyId: number): Map<number, number> {
    const result = new Map<number, number>()
    for (const [actorId, actorThreat] of this.threat) {
      const threat = actorThreat.get(enemyId) ?? 0
      if (threat > 0) {
        result.set(actorId, threat)
      }
    }
    return result
  }

  /**
   * Get all enemy threat values for a specific actor
   */
  getAllEnemyThreat(actorId: number): Map<number, number> {
    const actorThreat = this.threat.get(actorId)
    if (!actorThreat) {
      return new Map()
    }

    return new Map(
      Array.from(actorThreat.entries()).filter(([, threat]) => threat > 0),
    )
  }

  /**
   * Clear all threat for an actor against all enemies
   * Used when a player dies (threat wipe)
   * @returns Map of enemyId -> previousThreat for all cleared entries
   */
  clearAllThreatForActor(actorId: number): Map<number, number> {
    const actorThreat = this.threat.get(actorId)
    if (!actorThreat) {
      return new Map()
    }

    const clearedThreat = new Map<number, number>()
    for (const [enemyId, threat] of actorThreat) {
      if (threat > 0) {
        clearedThreat.set(enemyId, threat)
      }
    }

    // Remove the actor entirely from threat tracking
    this.threat.delete(actorId)
    return clearedThreat
  }
}
