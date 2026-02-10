/**
 * Per-actor state container
 *
 * Composes individual trackers (auras, gear, and future trackers) into a
 * single state object for each actor in a fight. Created and managed by
 * FightState.
 */
import type { GearItem } from '@wcl-threat/wcl-types'

import { AuraTracker } from './aura-tracker'
import { GearTracker } from './gear-tracker'

/** Composite state for a single actor during a fight */
export class ActorState {
  auraTracker: AuraTracker
  readonly gearTracker = new GearTracker()

  constructor(exclusiveAuras?: Set<number>[]) {
    this.auraTracker = new AuraTracker(exclusiveAuras)
  }

  /** Get active aura spell IDs */
  get auras(): Set<number> {
    return this.auraTracker.getAuras()
  }

  /** Get equipped gear */
  get gear(): GearItem[] {
    return this.gearTracker.getGear()
  }
}
