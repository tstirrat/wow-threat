/**
 * Threat Tracker
 *
 * Tracks cumulative threat for each actor against each enemy throughout a fight.
 * Used for abilities that need to query threat state (e.g., Patchwerk's Hateful Strike).
 */
import type {
  ActorId,
  EnemyInstanceReference,
  EnemyKey,
  EnemyReference,
} from './instance-refs'
import { buildEnemyKey, parseEnemyKey } from './instance-refs'

export interface EnemyThreatEntry {
  enemy: EnemyInstanceReference
  threat: number
}

export class ThreatTracker {
  // Map: actorId -> Map: enemyId:enemyInstance -> threat
  private threat = new Map<ActorId, Map<EnemyKey, number>>()

  /**
   * Add threat for an actor against an enemy
   */
  addThreat(actorId: ActorId, enemy: EnemyReference, amount: number): void {
    const enemyKey = buildEnemyKey(enemy)

    if (!this.threat.has(actorId)) {
      this.threat.set(actorId, new Map())
    }
    const actorThreat = this.threat.get(actorId)!
    const current = actorThreat.get(enemyKey) ?? 0
    actorThreat.set(enemyKey, Math.max(0, current + amount))
  }

  /**
   * Set threat for an actor against an enemy (replaces current value)
   * Clamps to minimum of 0
   */
  setThreat(actorId: ActorId, enemy: EnemyReference, amount: number): void {
    const clampedAmount = Math.max(0, amount)
    const enemyKey = buildEnemyKey(enemy)

    if (!this.threat.has(actorId)) {
      this.threat.set(actorId, new Map())
    }
    const actorThreat = this.threat.get(actorId)!
    actorThreat.set(enemyKey, clampedAmount)
  }

  /**
   * Get the current threat for an actor against an enemy
   */
  getThreat(actorId: ActorId, enemy: EnemyReference): number {
    const enemyKey = buildEnemyKey(enemy)
    return this.threat.get(actorId)?.get(enemyKey) ?? 0
  }

  /**
   * Get the top N actors by threat against a specific enemy
   * @returns Array of actors sorted by threat (highest first)
   */
  getTopActorsByThreat(
    enemy: EnemyReference,
    count: number,
  ): Array<{ actorId: ActorId; threat: number }> {
    const actors: Array<{ actorId: ActorId; threat: number }> = []
    const enemyKey = buildEnemyKey(enemy)

    for (const [actorId, actorThreat] of this.threat) {
      const threat = actorThreat.get(enemyKey) ?? 0
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
  getAllActorThreat(enemy: EnemyReference): Map<ActorId, number> {
    const result = new Map<ActorId, number>()
    const enemyKey = buildEnemyKey(enemy)

    for (const [actorId, actorThreat] of this.threat) {
      const threat = actorThreat.get(enemyKey) ?? 0
      if (threat > 0) {
        result.set(actorId, threat)
      }
    }
    return result
  }

  /**
   * Get all positive enemy threat values for a specific actor with instance metadata.
   */
  getAllEnemyThreatEntries(actorId: ActorId): EnemyThreatEntry[] {
    const actorThreat = this.threat.get(actorId)
    if (!actorThreat) {
      return []
    }

    return Array.from(actorThreat.entries())
      .filter(([, threat]) => threat > 0)
      .map(([enemyKey, threat]) => {
        const enemy = parseEnemyKey(enemyKey)
        return {
          enemy,
          threat,
        }
      })
  }

  /**
   * Clear all threat for an actor against all enemies
   * Used when a player dies (threat wipe)
   * @returns Cleared enemy entries with previous threat values
   */
  clearAllThreatForActor(actorId: ActorId): EnemyThreatEntry[] {
    const actorThreat = this.threat.get(actorId)
    if (!actorThreat) {
      return []
    }

    const clearedThreat: EnemyThreatEntry[] = []
    for (const [enemyKey, threat] of actorThreat) {
      if (threat > 0) {
        const enemy = parseEnemyKey(enemyKey)
        clearedThreat.push({
          enemy,
          threat,
        })
      }
    }

    // Remove the actor entirely from threat tracking
    this.threat.delete(actorId)
    return clearedThreat
  }
}
