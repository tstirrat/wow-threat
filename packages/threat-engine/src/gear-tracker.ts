/**
 * Per-actor gear tracking
 *
 * Stores the equipped gear for a single actor, updated when combatant info
 * events are received. Gear data is used to detect gear-based threat modifiers
 * via the gearImplications config hook.
 */
import type { GearItem } from '@wcl-threat/wcl-types'

/** Track equipped gear for a single actor */
export class GearTracker {
  private gear: GearItem[] = []

  /** Replace the actor's gear (from combatantinfo event) */
  setGear(gear: GearItem[]): void {
    this.gear = gear
  }

  /** Get the actor's current gear */
  getGear(): GearItem[] {
    return this.gear
  }
}
