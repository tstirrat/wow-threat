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
  EncounterId,
  EncounterThreatConfig,
  Enemy,
  ThreatEffect,
  ThreatCalculation,
  ThreatChange,
  ThreatConfig,
  ThreatStateKind,
  ThreatContext,
  ThreatModifier,
  ThreatResult,
  ThreatFormulaResult,
  WowClass,
} from '@wcl-threat/threat-config'
import {
  getActiveModifiers,
  getTotalMultiplier,
} from '@wcl-threat/threat-config'
import type { WCLEvent } from '@wcl-threat/wcl-types'

import { InterceptorTracker } from './interceptor-tracker'
import { FightState } from './fight-state'

const ENVIRONMENT_TARGET_ID = -1
const THREAT_EVENT_TYPES = new Set<WCLEvent['type']>([
  'damage',
  'heal',
  'energize',
  'cast',
  'applybuff',
  'refreshbuff',
  'applybuffstack',
  'removebuff',
  'removebuffstack',
  'applydebuff',
  'refreshdebuff',
  'applydebuffstack',
  'removedebuff',
  'removedebuffstack',
])

const NO_THREAT_FORMULA_RESULT: ThreatFormulaResult = {
  formula: '0',
  value: 0,
  splitAmongEnemies: false,
}

// ============================================================================
// Event Processing
// ============================================================================

export interface ProcessEventsInput {
  /** Raw WCL events from the API */
  rawEvents: WCLEvent[]
  /** Map of actor IDs to actor metadata */
  actorMap: Map<number, Actor>
  /** Ability school bitmasks indexed by ability ID */
  abilitySchoolMap?: Map<number, number>
  /** List of all enemies in the fight */
  enemies: Enemy[]
  /** Encounter ID for encounter-scoped behavior */
  encounterId?: number | null
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
  const {
    rawEvents,
    actorMap,
    abilitySchoolMap,
    enemies,
    encounterId: inputEncounterId,
    config,
  } = input

  const fightState = new FightState(actorMap, config)
  const interceptorTracker = new InterceptorTracker()
  const stateSpellSets = buildStateSpellSets(config)
  const augmentedEvents: AugmentedEvent[] = []
  const eventCounts: Record<string, number> = {}
  const encounterId = toEncounterId(inputEncounterId)
  const encounterConfig = getEncounterConfig(config, encounterId)
  const encounterPreprocessor =
    encounterId !== null
      ? encounterConfig?.preprocessor?.({
          encounterId,
          enemies,
        })
      : undefined

  for (const event of rawEvents) {
    // Update fight state (auras, gear, combatant info)
    fightState.processEvent(event, config)

    // Count event types
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1

    // Calculate threat for relevant event types
    if (shouldCalculateThreat(event)) {
      // Run event interceptors first
      const interceptorResults = interceptorTracker.runInterceptors(
        event,
        event.timestamp,
        fightState,
      )

      // Check if any interceptor wants to skip this event
      const shouldSkip = interceptorResults.some((r) => r.action === 'skip')
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

      // Collect augmentations from interceptors
      const augmentations = interceptorResults.filter(
        (r) => r.action === 'augment',
      )
      const threatRecipientOverride = augmentations.find(
        (a) => a.action === 'augment' && a.threatRecipientOverride,
      )?.threatRecipientOverride
      const interceptorEffects = augmentations.flatMap(
        (augmentation) => augmentation.effects ?? [],
      )

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
        spellSchoolMask: getSpellSchoolMaskForEvent(event, abilitySchoolMap),
        enemies,
        sourceActor,
        targetActor,
        encounterId,
        actors: fightState,
      }

      const threatContext = buildThreatContext(event, threatOptions)
      const baseCalculation = calculateModifiedThreat(event, threatOptions, config)
      const encounterEffects = encounterPreprocessor?.(threatContext)?.effects ?? []
      const stateEffect = buildStateEffectFromAuraEvent(event, stateSpellSets)
      const effects = [
        ...(baseCalculation.effects ?? []),
        ...encounterEffects,
        ...interceptorEffects,
        ...(stateEffect ? [stateEffect] : []),
      ]
      const calculation: ThreatCalculation = {
        ...baseCalculation,
        effects: effects.length > 0 ? effects : undefined,
      }

      for (const effect of effects) {
        if (effect.type === 'installInterceptor') {
          interceptorTracker.install(effect.interceptor, event.timestamp)
        }
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

  // Handle player death - wipe all threat for the dead player
  if (event.type === 'death' && event.targetIsFriendly) {
    return buildDeathThreatWipeChanges(fightState, event.targetID)
  }

  // Handle enemy death - just return empty changes (death is tracked in FightState)
  if (event.type === 'death' && !event.targetIsFriendly) {
    return changes
  }

  for (const effect of calculation.effects ?? []) {
    switch (effect.type) {
      case 'customThreat':
        changes.push(
          ...applyCustomThreatEffect(fightState, effect),
        )
        break
      case 'modifyThreat':
        changes.push(
          ...applyModifyThreatEffect(fightState, effect, event),
        )
        break
    }
  }

  // split threat among alive enemies only
  if (calculation.isSplit && calculation.modifiedThreat !== 0) {
    // Filter to alive enemies only
    const aliveEnemies = enemies.filter((e) =>
      fightState.isActorAlive({ id: e.id, instanceId: e.instance })
    )
    if (aliveEnemies.length > 0) {
      const splitThreat = calculation.modifiedThreat / aliveEnemies.length

      for (const enemy of aliveEnemies) {
        const change = applyThreatDelta(
          fightState,
          threatRecipient,
          enemy.id,
          enemy.instance,
          splitThreat,
        )
        if (change) {
          changes.push(change)
        }
      }
    }
  } else if (calculation.modifiedThreat !== 0) {
    // single target event
    const change = applyThreatDelta(
      fightState,
      threatRecipient,
      event.targetID,
      event.targetInstance ?? 0,
      calculation.modifiedThreat,
    )
    if (change) {
      changes.push(change)
    }
  }
  return changes
}

/** Apply additive threat change and return the effective delta after clamping */
function applyThreatDelta(
  fightState: FightState,
  sourceId: number,
  targetId: number,
  targetInstance: number,
  amount: number,
): ThreatChange | undefined {
  const enemy = { id: targetId, instanceId: targetInstance }
  const before = fightState.getThreat(sourceId, enemy)
  fightState.addThreat(sourceId, enemy, amount)
  const total = fightState.getThreat(sourceId, enemy)
  const appliedAmount = total - before

  if (appliedAmount === 0) {
    return undefined
  }

  return {
    sourceId,
    targetId,
    targetInstance,
    operator: 'add',
    amount: appliedAmount,
    total,
  }
}

/** Apply explicit custom threat changes */
function applyCustomThreatEffect(
  fightState: FightState,
  effect: Extract<ThreatEffect, { type: 'customThreat' }>,
): ThreatChange[] {
  for (const change of effect.changes) {
    if (change.operator === 'set') {
      fightState.setThreat(change.sourceId, {
        id: change.targetId,
        instanceId: change.targetInstance,
      }, change.total)
    } else {
      const currentThreat = fightState.getThreat(
        change.sourceId,
        {
          id: change.targetId,
          instanceId: change.targetInstance,
        },
      )
      const delta = change.total - currentThreat
      fightState.addThreat(change.sourceId, {
        id: change.targetId,
        instanceId: change.targetInstance,
      }, delta)
    }
  }

  return [...effect.changes]
}

/** Apply threat multipliers to either a single target or all actors on an enemy */
function applyModifyThreatEffect(
  fightState: FightState,
  effect: Extract<ThreatEffect, { type: 'modifyThreat' }>,
  event: WCLEvent,
): ThreatChange[] {
  if (effect.target === 'all') {
    // Friendly source abilities (e.g., Vanish, Feign Death):
    // modify this actor's threat against all enemies.
    if (event.sourceIsFriendly) {
      const actorId = event.sourceID
      const enemyThreatEntries = fightState.getAllEnemyThreatEntries(actorId)

      return enemyThreatEntries.map(({ enemy, threat }) => {
        const newThreat = calculateThreatModification(
          threat,
          effect.multiplier,
        )
        fightState.setThreat(actorId, enemy, newThreat)

        return {
          sourceId: actorId,
          targetId: enemy.id,
          targetInstance: enemy.instanceId,
          operator: 'set' as const,
          amount: newThreat,
          total: newThreat,
        }
      })
    }

    // Enemy source abilities (e.g., Noth Blink):
    // modify all actors on this enemy's threat table.
    const enemyId = event.sourceID
    const enemyInstance = event.sourceInstance ?? 0
    const enemy = { id: enemyId, instanceId: enemyInstance }
    const actorThreat = fightState.getAllActorThreat(enemy)

    return Array.from(actorThreat.entries()).map(([actorId, currentThreat]) => {
      const newThreat = calculateThreatModification(currentThreat, effect.multiplier)
      fightState.setThreat(actorId, enemy, newThreat)

      return {
        sourceId: actorId,
        targetId: enemyId,
        targetInstance: enemyInstance,
        operator: 'set' as const,
        amount: newThreat,
        total: newThreat,
      }
    })
  }

  const sourceEnemyInstance = event.sourceInstance ?? 0
  const currentThreat = fightState.getThreat(
    event.targetID,
    {
      id: event.sourceID,
      instanceId: sourceEnemyInstance,
    },
  )
  const newThreat = calculateThreatModification(currentThreat, effect.multiplier)
  fightState.setThreat(
    event.targetID,
    {
      id: event.sourceID,
      instanceId: sourceEnemyInstance,
    },
    newThreat,
  )

  return [
    {
      sourceId: event.targetID,
      targetId: event.sourceID,
      targetInstance: sourceEnemyInstance,
      operator: 'set',
      amount: newThreat,
      total: newThreat,
    },
  ]
}

/** Build set-to-zero threat changes for a dead player */
function buildDeathThreatWipeChanges(
  fightState: FightState,
  deadPlayerId: number,
): ThreatChange[] {
  const clearedThreat = fightState.clearAllThreatForActor(deadPlayerId)

  return clearedThreat.map(({ enemy }) => ({
    sourceId: deadPlayerId,
    targetId: enemy.id,
    targetInstance: enemy.instanceId,
    operator: 'set' as const,
    amount: 0,
    total: 0,
  }))
}

/**
 * Determine if an event should have threat calculated
 */
function shouldCalculateThreat(event: WCLEvent): boolean {
  // Always process death events (for threat wipe tracking)
  if (event.type === 'death') {
    return true
  }
  if (event.type === 'damage' && event.targetIsFriendly) {
    return false
  }
  if (event.targetID === ENVIRONMENT_TARGET_ID) {
    return false
  }
  return THREAT_EVENT_TYPES.has(event.type)
}

function getSpellSchoolMaskForEvent(
  event: WCLEvent,
  abilitySchoolMap?: Map<number, number>,
): number {
  if (!abilitySchoolMap || !('abilityGameID' in event)) {
    return 0
  }

  if (event.abilityGameID === undefined) {
    return 0
  }

  return abilitySchoolMap.get(event.abilityGameID) ?? 0
}

interface ThreatStateSpellSets {
  fixate: Set<number>
  aggroLoss: Set<number>
  invulnerable: Set<number>
}

/** Build merged spell sets for threat state markers from global + class config. */
function buildStateSpellSets(config: ThreatConfig): ThreatStateSpellSets {
  const fixate = new Set<number>(config.fixateBuffs ?? [])
  const aggroLoss = new Set<number>(config.aggroLossBuffs ?? [])
  const invulnerable = new Set<number>(config.invulnerabilityBuffs ?? [])

  for (const classConfig of Object.values(config.classes)) {
    for (const spellId of classConfig?.fixateBuffs ?? []) {
      fixate.add(spellId)
    }
    for (const spellId of classConfig?.aggroLossBuffs ?? []) {
      aggroLoss.add(spellId)
    }
    for (const spellId of classConfig?.invulnerabilityBuffs ?? []) {
      invulnerable.add(spellId)
    }
  }

  return {
    fixate,
    aggroLoss,
    invulnerable,
  }
}

/** Derive state-style threat effects from aura apply/remove events. */
function buildStateEffectFromAuraEvent(
  event: WCLEvent,
  stateSpellSets: ThreatStateSpellSets,
): Extract<ThreatEffect, { type: 'state' }> | undefined {
  if (
    !('abilityGameID' in event) ||
    typeof event.abilityGameID !== 'number'
  ) {
    return undefined
  }

  const phase = getStatePhase(event)
  if (!phase) {
    return undefined
  }

  const spellId = event.abilityGameID
  if (spellId === undefined) {
    return undefined
  }

  const kind = getStateKind(spellId, stateSpellSets)
  if (!kind) {
    return undefined
  }

  const baseState = {
    kind,
    phase,
    spellId,
    actorId: kind === 'fixate' ? event.sourceID : event.targetID,
    name: phase === 'start' ? getAbilityName(event) : undefined,
  } as const

  if (kind === 'fixate') {
    return {
      type: 'state',
      state: {
        ...baseState,
        targetId: event.targetID,
        targetInstance: event.targetInstance ?? 0,
      },
    }
  }

  return {
    type: 'state',
    state: baseState,
  }
}

function getStatePhase(event: WCLEvent): 'start' | 'end' | undefined {
  if (
    event.type === 'applybuff' ||
    event.type === 'refreshbuff' ||
    event.type === 'applybuffstack' ||
    event.type === 'applydebuff' ||
    event.type === 'refreshdebuff' ||
    event.type === 'applydebuffstack'
  ) {
    return 'start'
  }
  if (event.type === 'removebuff' || event.type === 'removedebuff') {
    return 'end'
  }
  if (
    (event.type === 'removebuffstack' || event.type === 'removedebuffstack') &&
    event.stacks !== undefined &&
    event.stacks <= 0
  ) {
    return 'end'
  }
  return undefined
}

function getStateKind(
  spellId: number,
  stateSpellSets: ThreatStateSpellSets,
): ThreatStateKind | undefined {
  if (stateSpellSets.fixate.has(spellId)) {
    return 'fixate'
  }
  if (stateSpellSets.aggroLoss.has(spellId)) {
    return 'aggroLoss'
  }
  if (stateSpellSets.invulnerable.has(spellId)) {
    return 'invulnerable'
  }
  return undefined
}

function getAbilityName(event: WCLEvent): string | undefined {
  const fallback =
    'abilityGameID' in event ? `Spell ${event.abilityGameID}` : undefined

  if (!('ability' in event)) {
    return fallback
  }

  const ability = event.ability as { name?: unknown } | undefined
  if (!ability || typeof ability.name !== 'string') {
    return fallback
  }

  return ability.name
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
  if ('resourceChange' in event) {
    base.resourceChange = event.resourceChange
  }
  if ('resourceChangeType' in event) {
    base.resourceChangeType = event.resourceChangeType
  }
  if ('waste' in event) {
    base.waste = event.waste
  }
  if ('stacks' in event) {
    base.stacks = event.stacks
  }
  if ('killerID' in event) {
    base.killerID = event.killerID
  }

  return base
}

// ============================================================================
// Threat Calculation
// ============================================================================

export interface CalculateThreatOptions {
  sourceAuras: Set<number>
  targetAuras: Set<number>
  spellSchoolMask?: number
  enemies: Enemy[] // Still needed for building threat values
  sourceActor: Actor
  targetActor: Actor
  encounterId: EncounterId | null
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
  const ctx = buildThreatContext(event, options)

  // Get the threat formula result
  const formulaResult = getFormulaResult(ctx, config)

  // Era parity: resource generation threat does not use player coefficients/modifiers.
  const allModifiers: ThreatModifier[] =
    event.type === 'energize'
      ? []
      : [
          ...getClassModifiers(options.sourceActor.class, config),
          ...getAuraModifiers(ctx, config),
        ]

  // Calculate total multiplier
  const totalMultiplier = getTotalMultiplier(allModifiers)
  const modifiedThreat = formulaResult.value * totalMultiplier

  return {
    formula: formulaResult.formula,
    amount: ctx.amount,
    baseThreat: formulaResult.value,
    modifiedThreat: modifiedThreat,
    isSplit: formulaResult.splitAmongEnemies,
    modifiers: allModifiers,
    effects: formulaResult.effects,
  }
}

function buildThreatContext(
  event: WCLEvent,
  options: CalculateThreatOptions,
): ThreatContext {
  const amount = getEventAmount(event)
  const spellSchoolMask = options.spellSchoolMask ?? 0

  return {
    event,
    amount,
    spellSchoolMask,
    sourceAuras: options.sourceAuras,
    targetAuras: options.targetAuras,
    sourceActor: options.sourceActor,
    targetActor: options.targetActor,
    encounterId: options.encounterId,
    actors: options.actors,
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

  // Merge abilities: global first, then class.
  // Class abilities override global abilities on duplicate spell IDs.
  if ('abilityGameID' in event && typeof event.abilityGameID === 'number') {
    const classConfig = getClassConfig(ctx.sourceActor.class, config)
    const mergedAbilities = {
      ...(config.abilities ?? {}),
      ...(classConfig?.abilities ?? {}),
    }

    const abilityFormula = mergedAbilities[event.abilityGameID]
    if (abilityFormula) {
      // Ability formulas override base formulas; undefined means this phase has no threat.
      return abilityFormula(ctx) ?? NO_THREAT_FORMULA_RESULT
    }
  }

  // Fall back to base threat formulas by event type
  switch (event.type) {
    case 'damage':
      return config.baseThreat.damage(ctx) ?? NO_THREAT_FORMULA_RESULT
    case 'heal':
      return config.baseThreat.heal(ctx) ?? NO_THREAT_FORMULA_RESULT
    case 'energize':
      return config.baseThreat.energize(ctx) ?? NO_THREAT_FORMULA_RESULT
    default:
      return NO_THREAT_FORMULA_RESULT
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

function getEncounterConfig(
  config: ThreatConfig,
  encounterId: EncounterId | null,
): EncounterThreatConfig | null {
  if (encounterId === null) {
    return null
  }
  return config.encounters?.[encounterId] ?? null
}

function toEncounterId(
  encounterId: number | null | undefined,
): EncounterId | null {
  if (encounterId === null || encounterId === undefined) {
    return null
  }
  return encounterId as EncounterId
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
