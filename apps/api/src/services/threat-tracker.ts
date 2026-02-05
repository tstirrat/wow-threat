/**
 * Threat Tracker
 *
 * Tracks cumulative threat for each actor against each enemy throughout a fight.
 * Used for abilities that need to query threat state (e.g., Patchwerk's Hateful Strike).
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
    count: number
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
}
