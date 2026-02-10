/**
 * Position Tracker
 *
 * Tracks XY coordinates for all actors throughout a fight.
 * Used for abilities that require distance calculations (e.g., Patchwerk's Hateful Strike).
 */
import type { ActorKey, ActorReference } from './instance-refs'
import { buildActorKey, parseActorKey } from './instance-refs'

interface Position {
  x: number
  y: number
}

export class PositionTracker {
  private positions = new Map<ActorKey, Position>()

  /**
   * Update the position of an actor
   */
  updatePosition(actor: ActorReference, x: number, y: number): void {
    const actorKey = buildActorKey(actor)
    this.positions.set(actorKey, { x, y })
  }

  /**
   * Get the current position of an actor
   * @returns Position or null if not available
   */
  getPosition(actor: ActorReference): Position | null {
    const actorKey = buildActorKey(actor)
    return this.positions.get(actorKey) ?? null
  }

  /**
   * Calculate the distance between two actors
   * @returns Distance in yards, or null if either position is unavailable
   */
  getDistance(actor1: ActorReference, actor2: ActorReference): number | null {
    const pos1 = this.getPosition(actor1)
    const pos2 = this.getPosition(actor2)
    if (!pos1 || !pos2) return null

    const dx = pos2.x - pos1.x
    const dy = pos2.y - pos1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Get all actors within a certain distance of a given actor
   * @returns Array of actor IDs within range
   */
  getActorsInRange(actor: ActorReference, maxDistance: number): number[] {
    const sourceKey = buildActorKey(actor)
    const pos = this.positions.get(sourceKey)
    if (!pos) return []

    const result = new Set<number>()
    for (const [otherKey, otherPos] of this.positions) {
      if (otherKey === sourceKey) continue
      const dx = otherPos.x - pos.x
      const dy = otherPos.y - pos.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance <= maxDistance) {
        const { id: otherActorId } = parseActorKey(otherKey)
        result.add(otherActorId)
      }
    }
    return [...result]
  }
}
