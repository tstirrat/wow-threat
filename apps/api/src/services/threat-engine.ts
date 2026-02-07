/**
 * Threat Engine
 *
 * Core threat calculation and event processing. Orchestrates fight state management,
 * aura tracking, and threat calculation for raw WCL events. Pure function - no side effects
 * except internal state management during processing.
 */
import type {
  Actor,
  ActorContext,
  AugmentedEvent,
  ClassThreatConfig,
  Enemy,
  ThreatCalculation,
  ThreatChange,
  ThreatConfig,
  ThreatContext,
  ThreatModifier,
  ThreatResult,
  WowClass,
} from '@wcl-threat/threat-config'
import {
  getActiveModifiers,
  getTotalMultiplier,
} from '@wcl-threat/threat-config'
import type { WCLEvent } from '@wcl-threat/wcl-types'

import { EffectTracker } from './effect-tracker'
import { FightState } from './fight-state'

const ENVIRONMENT_TARGET_ID = -1

// ============================================================================
// Event Processing
// ============================================================================

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
  const effectTracker = new EffectTracker()
  const augmentedEvents: AugmentedEvent[] = []
  const eventCounts: Record<string, number> = {}

  for (const event of rawEvents) {
    // Update fight state (auras, gear, combatant info)
    fightState.processEvent(event, config)

    // Count event types
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1

    // Calculate threat for relevant event types
    if (shouldCalculateThreat(event)) {
      // Run effect handlers first
      const handlerResults = effectTracker.runHandlers(
        event,
        event.timestamp,
        fightState,
      )

      // Check if any handler wants to skip this event
      const shouldSkip = handlerResults.some((r) => r.action === 'skip')
      if (shouldSkip) {
        // Create zero-threat augmented event
        const zeroCalculation: ThreatCalculation = {
          formula: '0 (suppressed by effect)',
          amount: 0,
          baseThreat: 0,
          modifiedThreat: 0,
          isSplit: false,
          modifiers: [],
        }
        augmentedEvents.push(buildAugmentedEvent(event, zeroCalculation, []))
        continue
      }

      // Collect augmentations from handlers
      const augmentations = handlerResults.filter((r) => r.action === 'augment')
      const threatRecipientOverride = augmentations.find(
        (a) => a.action === 'augment' && a.threatRecipientOverride,
      )?.threatRecipientOverride

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
        actors: fightState,
      }

      const calculation = calculateModifiedThreat(event, threatOptions, config)

      // Handle installHandler special
      if (calculation.special?.type === 'installHandler') {
        effectTracker.install(calculation.special.handler, event.timestamp)
      }

      const validEnemies = enemies.filter((e) => e.id !== ENVIRONMENT_TARGET_ID)

      const changes = applyThreat(
        fightState,
        calculation,
        event,
        validEnemies,
        threatRecipientOverride,
      )

      augmentedEvents.push(
        buildAugmentedEvent(
          event,
          calculation,
          changes.length > 0 ? changes : undefined,
        ),
      )
    }
  }

  return {
    augmentedEvents,
    eventCounts,
  }
}

/** Apply threat to relevant enemies in the fight state */
function applyThreat(
  fightState: FightState,
  calculation: ThreatCalculation,
  event: WCLEvent,
  enemies: Enemy[],
  threatRecipientOverride?: number,
): ThreatChange[] {
  const changes: ThreatChange[] = []
  const threatRecipient = threatRecipientOverride ?? event.sourceID

  if (calculation.special?.type === 'customThreat') {
    for (const mod of calculation.special.modifications) {
      fightState.addThreat(mod.actorId, mod.enemyId, mod.amount)
      changes.push({
        sourceId: mod.actorId,
        targetId: mod.enemyId,
        targetInstance: 0, // TODO: Instance tracking
        operator: 'add',
        amount: mod.amount,
        total: fightState.getThreat(mod.actorId, mod.enemyId),
      })
    }
  }

  // Process threat modifications (boss abilities that modify threat)
  if (calculation.special?.type === 'modifyThreat') {
    const currentThreat = fightState.getThreat(event.targetID, event.sourceID)
    const newThreat = calculateThreatModification(
      currentThreat,
      calculation.special.multiplier,
    )
    fightState.setThreat(event.targetID, event.sourceID, newThreat)
    changes.push({
      sourceId: event.targetID,
      targetId: event.sourceID,
      targetInstance: event.sourceInstance ?? 0,
      operator: 'set',
      amount: newThreat,
      total: newThreat,
    })
  }

  // split threat
  if (calculation.isSplit && calculation.modifiedThreat > 0) {
    // Filter out environment targets from split threat
    const splitThreat = calculation.modifiedThreat / enemies.length

    for (const enemy of enemies) {
      // TODO: check enemies are alive
      fightState.addThreat(threatRecipient, enemy.id, splitThreat)
      changes.push({
        sourceId: threatRecipient,
        targetId: enemy.id,
        targetInstance: enemy.instance,
        operator: 'add',
        amount: splitThreat,
        total: fightState.getThreat(threatRecipient, enemy.id),
      })
    }
  } else if (calculation.modifiedThreat > 0) {
    // single target event
    fightState.addThreat(
      threatRecipient,
      event.targetID,
      calculation.modifiedThreat,
    )
    changes.push({
      sourceId: threatRecipient,
      targetId: event.targetID,
      targetInstance: event.targetInstance ?? 0,
      operator: 'add',
      amount: calculation.modifiedThreat,
      total: fightState.getThreat(threatRecipient, event.targetID),
    })
  }
  return changes
}

/**
 * Determine if an event should have threat calculated
 */
function shouldCalculateThreat(event: WCLEvent): boolean {
  if (event.type === 'damage' && event.targetIsFriendly) {
    return false
  }
  if (event.targetID === ENVIRONMENT_TARGET_ID) {
    return false
  }
  return ['damage', 'heal', 'energize', 'cast'].includes(event.type)
}

/**
 * Build an augmented event from a WCL event and threat result
 */
function buildAugmentedEvent(
  event: WCLEvent,
  calculation: ThreatCalculation,
  changes: ThreatChange[] | undefined,
): AugmentedEvent {
  // Add cumulative threat values from fight state
  const threatWithCumulative: ThreatResult = {
    calculation,
    changes,
  }

  const base: AugmentedEvent = {
    timestamp: event.timestamp,
    type: event.type,
    sourceID: event.sourceID,
    sourceIsFriendly: event.sourceIsFriendly,
    targetID: event.targetID,
    targetIsFriendly: event.targetIsFriendly,
    sourceInstance: event.sourceInstance,
    targetInstance: event.targetInstance,
    threat: threatWithCumulative,
  }

  // Add event-specific fields
  if ('abilityGameID' in event) {
    base.abilityGameID = event.abilityGameID
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

// ============================================================================
// Threat Calculation
// ============================================================================

export interface CalculateThreatOptions {
  sourceAuras: Set<number>
  targetAuras: Set<number>
  enemies: Enemy[] // Still needed for building threat values
  sourceActor: Actor
  targetActor: Actor
  encounterId: number | null
  actors: ActorContext // NEW: Actor state accessors
}

/**
 * Calculate threat with modifications
 */
export function calculateModifiedThreat(
  event: WCLEvent,
  options: CalculateThreatOptions,
  config: ThreatConfig,
): ThreatCalculation {
  const amount = getEventAmount(event)

  const ctx: ThreatContext = {
    event,
    amount,
    sourceAuras: options.sourceAuras,
    targetAuras: options.targetAuras,
    sourceActor: options.sourceActor,
    targetActor: options.targetActor,
    encounterId: options.encounterId,
    actors: options.actors, // NEW: Actor context
  }

  // Get the threat formula result
  const formulaResult = getFormulaResult(ctx, config)

  // Collect all modifiers (no longer from formula result)
  const allModifiers: ThreatModifier[] = [
    ...getClassModifiers(options.sourceActor.class, config),
    ...getAuraModifiers(ctx, config),
  ]

  // Calculate total multiplier
  const totalMultiplier = getTotalMultiplier(allModifiers)
  const modifiedThreat = formulaResult.value * totalMultiplier

  return {
    formula: formulaResult.formula,
    amount: amount,
    baseThreat: formulaResult.value,
    modifiedThreat: modifiedThreat,
    isSplit: formulaResult.splitAmongEnemies,
    modifiers: allModifiers,
    special: formulaResult.special, // NEW: Include special behaviors
  }
}

/**
 * Calculate threat modification: multiply current threat by multiplier, floor at 0
 */
export function calculateThreatModification(
  currentThreat: number,
  multiplier: number,
): number {
  return Math.max(0, currentThreat * multiplier)
}

/**
 * Get the relevant amount from an event (damage, heal, etc.)
 */
function getEventAmount(event: WCLEvent): number {
  switch (event.type) {
    case 'damage':
      return event.amount
    case 'heal': {
      // Only effective healing generates threat (exclude overheal)
      const overheal = 'overheal' in event ? event.overheal : 0
      return Math.max(0, event.amount - overheal)
    }
    case 'energize':
      // Only actual resource gained generates threat (exclude waste)
      return Math.max(0, event.resourceChange - event.waste)
    default:
      return 0
  }
}

/**
 * Get the formula result for an event
 */
function getFormulaResult(ctx: ThreatContext, config: ThreatConfig) {
  const event = ctx.event

  // Merge abilities: global first, then class (class overrides global on duplicates)
  if ('abilityGameID' in event && event.abilityGameID) {
    const classConfig = getClassConfig(ctx.sourceActor.class, config)
    const mergedAbilities = {
      ...(config.abilities ?? {}),
      ...(classConfig?.abilities ?? {}),
    }

    const abilityFormula = mergedAbilities[event.abilityGameID]
    if (abilityFormula) {
      return abilityFormula(ctx)
    }
  }

  // Fall back to base threat formulas by event type
  switch (event.type) {
    case 'damage':
      return config.baseThreat.damage(ctx)
    case 'heal':
      return config.baseThreat.heal(ctx)
    case 'energize':
      return config.baseThreat.energize(ctx)
    default:
      // Default: no threat
      return {
        formula: '0',
        value: 0,
        splitAmongEnemies: false,
      }
  }
}

/**
 * Get class config for an actor
 */
function getClassConfig(
  wowClass: WowClass | null,
  config: ThreatConfig,
): ClassThreatConfig | null {
  if (!wowClass) return null
  return config.classes[wowClass] ?? null
}

/**
 * Get class-specific base threat factor modifier
 */
function getClassModifiers(
  wowClass: WowClass | null,
  config: ThreatConfig,
): ThreatModifier[] {
  const classConfig = getClassConfig(wowClass, config)
  if (!classConfig?.baseThreatFactor || classConfig.baseThreatFactor === 1) {
    return []
  }

  const className = wowClass
    ? wowClass.charAt(0).toUpperCase() + wowClass.slice(1)
    : 'Class'

  return [
    {
      source: 'class',
      name: className,
      value: classConfig.baseThreatFactor,
    },
  ]
}

/**
 * Get all active aura modifiers (global + all classes)
 * This allows cross-class buffs (e.g., Blessing of Salvation) to apply to any actor.
 * The game validates which buffs can be applied, so we merge everything and let
 * the sourceAuras set determine which modifiers actually apply.
 */
function getAuraModifiers(
  ctx: ThreatContext,
  config: ThreatConfig,
): ThreatModifier[] {
  // Merge all aura modifiers into a single structure
  const mergedAuraModifiers: Record<
    number,
    (ctx: ThreatContext) => ThreatModifier
  > = {
    ...config.auraModifiers,
  }

  // Add aura modifiers from all class configs
  for (const classConfig of Object.values(config.classes)) {
    if (classConfig?.auraModifiers) {
      Object.assign(mergedAuraModifiers, classConfig.auraModifiers)
    }
  }

  // Apply the merged aura modifiers based on active auras
  return getActiveModifiers(ctx, mergedAuraModifiers)
}
