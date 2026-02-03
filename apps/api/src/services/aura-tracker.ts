/**
 * Per-actor aura tracking
 *
 * Tracks the set of active spell IDs (buffs/debuffs) on a single actor.
 * Used by ActorState to provide aura information for threat calculations.
 * Handles automatic removal of mutually exclusive auras (e.g., warrior stances).
 */

/** Track active auras for a single actor */
export class AuraTracker {
  private activeAuras = new Set<number>()
  private exclusiveAuras?: Set<number>[]

  constructor(exclusiveAuras?: Set<number>[]) {
    this.exclusiveAuras = exclusiveAuras
  }

  /** Add an aura (buff or debuff applied) */
  addAura(spellId: number): void {
    // If this aura is in an exclusive set, remove other auras in that set
    if (this.exclusiveAuras) {
      for (const auraSet of this.exclusiveAuras) {
        if (auraSet.has(spellId)) {
          // Remove all other auras in this exclusive set
          for (const existingId of auraSet) {
            if (existingId !== spellId) {
              this.activeAuras.delete(existingId)
            }
          }
          break
        }
      }
    }
    this.activeAuras.add(spellId)
  }

  /** Remove an aura (buff or debuff removed) */
  removeAura(spellId: number): void {
    this.activeAuras.delete(spellId)
  }

  /** Seed multiple auras at once (e.g. from combatantinfo initial state) */
  seedAuras(spellIds: number[]): void {
    for (const id of spellIds) {
      this.addAura(id)
    }
  }

  /** Get all active aura spell IDs */
  getAuras(): Set<number> {
    return this.activeAuras
  }
}
