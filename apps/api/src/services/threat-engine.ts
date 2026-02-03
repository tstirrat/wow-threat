/**
 * Threat Engine
 *
 * Core threat calculation and event processing. Orchestrates fight state management,
 * aura tracking, and threat calculation for raw WCL events. Pure function - no side effects
 * except internal state management during processing.
 */

import type { WCLEvent } from '@wcl-threat/wcl-types'
import type {
  ThreatConfig,
  AugmentedEvent,
  Actor,
  Enemy,
} from '@wcl-threat/threat-config'

import { calculateThreat, type CalculateThreatOptions } from './threat'
import { FightState } from './fight-state'

export interface ProcessEventsInput {
  /** Raw WCL events from the API */
  rawEvents: WCLEvent[]
  /** Map of actor IDs to actor metadata */
  actorMap: Map<number, Actor>
  /** List of all enemies in the fight */
  enemies: Enemy[]
  /** Threat configuration for the game version */
  config: ThreatConfig
}

export interface ProcessEventsOutput {
  /** Events augmented with threat calculations */
  augmentedEvents: AugmentedEvent[]
  /** Count of each event type processed */
  eventCounts: Record<string, number>
}

/**
 * Process raw WCL events and calculate threat
 *
 * Orchestrates the full threat calculation pipeline:
 * 1. Initialize fight state for aura/gear tracking
 * 2. Process each event through fight state (updates auras, gear)
 * 3. Calculate threat for relevant event types
 * 4. Build augmented events with threat data
 */
export function processEvents(input: ProcessEventsInput): ProcessEventsOutput {
  const { rawEvents, actorMap, enemies, config } = input

  const fightState = new FightState(actorMap, config)
  const augmentedEvents: AugmentedEvent[] = []
  const eventCounts: Record<string, number> = {}

  for (const event of rawEvents) {
    // Update fight state (auras, gear, combatant info)
    fightState.processEvent(event, config)

    // Count event types
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1

    // Calculate threat for relevant event types
    if (shouldCalculateThreat(event)) {
      const sourceActor = actorMap.get(event.sourceID) ?? {
        id: event.sourceID,
        name: 'Unknown',
        class: null,
      }
      const targetActor = actorMap.get(event.targetID) ?? {
        id: event.targetID,
        name: 'Unknown',
        class: null,
      }

      const threatOptions: CalculateThreatOptions = {
        sourceAuras: fightState.getAuras(event.sourceID),
        targetAuras: fightState.getAuras(event.targetID),
        enemies,
        sourceActor,
        targetActor,
        encounterId: null,
      }

      const threatResult = calculateThreat(event, threatOptions, config)
      augmentedEvents.push(buildAugmentedEvent(event, threatResult))
    }
  }

  return {
    augmentedEvents,
    eventCounts,
  }
}

/**
 * Determine if an event should have threat calculated
 */
function shouldCalculateThreat(event: WCLEvent): boolean {
  return ['damage', 'heal', 'energize', 'cast'].includes(event.type)
}

/**
 * Build an augmented event from a WCL event and threat result
 */
function buildAugmentedEvent(
  event: WCLEvent,
  threatResult: ReturnType<typeof calculateThreat>
): AugmentedEvent {
  const base: AugmentedEvent = {
    timestamp: event.timestamp,
    type: event.type,
    sourceID: event.sourceID,
    sourceIsFriendly: event.sourceIsFriendly,
    targetID: event.targetID,
    targetIsFriendly: event.targetIsFriendly,
    sourceInstance: event.sourceInstance,
    targetInstance: event.targetInstance,
    threat: threatResult,
  }

  // Add event-specific fields
  if ('ability' in event) {
    base.ability = event.ability
  }
  if ('amount' in event) {
    base.amount = event.amount
  }
  if ('absorbed' in event) {
    base.absorbed = event.absorbed
  }
  if ('blocked' in event) {
    base.blocked = event.blocked
  }
  if ('mitigated' in event) {
    base.mitigated = event.mitigated
  }
  if ('overkill' in event) {
    base.overkill = event.overkill
  }
  if ('overheal' in event) {
    base.overheal = event.overheal
  }
  if ('hitType' in event) {
    base.hitType = event.hitType
  }
  if ('tick' in event) {
    base.tick = event.tick
  }

  return base
}
