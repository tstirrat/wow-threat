/**
 * Per-actor aura tracking
 *
 * Tracks the set of active spell IDs (buffs/debuffs) on a single actor.
 * Used by ActorState to provide aura information for threat calculations.
 */

/** Track active auras for a single actor */
export class AuraTracker {
  private activeAuras = new Set<number>()

  /** Add an aura (buff or debuff applied) */
  addAura(spellId: number): void {
    this.activeAuras.add(spellId)
  }

  /** Remove an aura (buff or debuff removed) */
  removeAura(spellId: number): void {
    this.activeAuras.delete(spellId)
  }

  /** Seed multiple auras at once (e.g. from combatantinfo initial state) */
  seedAuras(spellIds: number[]): void {
    for (const id of spellIds) {
      this.activeAuras.add(id)
    }
  }

  /** Get all active aura spell IDs */
  getAuras(): Set<number> {
    return this.activeAuras
  }
}
