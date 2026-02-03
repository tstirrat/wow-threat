/**
 * Fight-level state management
 *
 * Orchestrates per-actor state tracking throughout a fight. Routes events to
 * the appropriate actor's trackers and coordinates cross-tracker concerns
 * (e.g. gear implications producing synthetic auras).
 */

import type { WCLEvent, GearItem } from '@wcl-threat/wcl-types'
import type { ThreatConfig, Actor, WowClass } from '@wcl-threat/threat-config'

import { ActorState } from './actor-state'

/** Top-level state container for a fight */
export class FightState {
  private actors = new Map<number, ActorState>()
  private actorMap: Map<number, Actor>
  private config: ThreatConfig
  private allExclusiveAuras: Set<number>[]

  constructor(actorMap: Map<number, Actor>, config: ThreatConfig) {
    this.actorMap = actorMap
    this.config = config
    // Consolidate all exclusive auras from all class configs
    this.allExclusiveAuras = this.collectAllExclusiveAuras(config)
  }

  /** Collect all exclusive aura sets from all class configs */
  private collectAllExclusiveAuras(config: ThreatConfig): Set<number>[] {
    const allSets: Set<number>[] = []
    for (const classConfig of Object.values(config.classes)) {
      if (classConfig?.exclusiveAuras) {
        allSets.push(...classConfig.exclusiveAuras)
      }
    }
    return allSets
  }

  /** Process a WCL event and update relevant actor state */
  processEvent(event: WCLEvent, config: ThreatConfig): void {
    switch (event.type) {
      case 'combatantinfo':
        this.processCombatantInfo(event, config)
        break
      case 'applybuff':
      case 'applydebuff':
        this.getOrCreateActorState(event.targetID).auraTracker.addAura(
          event.ability.guid,
        )
        break
      case 'removebuff':
      case 'removedebuff':
        this.getOrCreateActorState(event.targetID).auraTracker.removeAura(
          event.ability.guid,
        )
        break
    }
  }

  /** Get the composite state for an actor */
  getActorState(actorId: number): ActorState | undefined {
    return this.actors.get(actorId)
  }

  /** Get active auras for an actor (convenience method) */
  getAuras(actorId: number): Set<number> {
    return this.actors.get(actorId)?.auras ?? new Set()
  }

  /** Get equipped gear for an actor (convenience method) */
  getGear(actorId: number): GearItem[] {
    return this.actors.get(actorId)?.gear ?? []
  }

  /** Process a combatantinfo event: seed auras, store gear, run gear implications */
  private processCombatantInfo(
    event: Extract<WCLEvent, { type: 'combatantinfo' }>,
    config: ThreatConfig,
  ): void {
    const actorState = this.getOrCreateActorState(event.sourceID)

    // Seed initial auras from combatant info
    if (event.auras) {
      actorState.auraTracker.seedAuras(
        event.auras.map((a) => a.ability),
      )
    }

    // Store gear
    if (event.gear) {
      actorState.gearTracker.setGear(event.gear)

      // Run gear implications to inject synthetic auras
      const actor = this.actorMap.get(event.sourceID)
      const wowClass = actor?.class as WowClass | null
      if (wowClass) {
        const classConfig = config.classes[wowClass]
        if (classConfig?.gearImplications) {
          const syntheticAuras = classConfig.gearImplications(event.gear)
          actorState.auraTracker.seedAuras(syntheticAuras)
        }
      }
    }
  }

  /** Get or create an ActorState for the given actor ID */
  private getOrCreateActorState(actorId: number): ActorState {
    let state = this.actors.get(actorId)
    if (!state) {
      // Use consolidated exclusive auras from all classes
      // (e.g., paladin blessings can be applied to any class)
      state = new ActorState(this.allExclusiveAuras)
      this.actors.set(actorId, state)
    }
    return state
  }
}
