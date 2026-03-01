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
  AppliedThreatModifier,
  AugmentedEvent,
  ClassThreatConfig,
  EncounterId,
  EncounterThreatConfig,
  Enemy,
  SpellId,
  ThreatCalculation,
  ThreatChange,
  ThreatConfig,
  ThreatContext,
  ThreatEffect,
  ThreatFormula,
  ThreatModifier,
  ThreatResult,
  ThreatStateKind,
  WowClass,
} from '@wow-threat/shared'
import type { Report, ReportFight, WCLEvent } from '@wow-threat/wcl-types'

import {
  createProcessorNamespace,
  initialAuraAdditionsKey,
  mergeInitialAurasWithAdditions,
  runFightPrepass,
} from './event-processors'
import type {
  FightProcessor,
  FightProcessorFactory,
  MainPassEventContext,
  ProcessorBaseContext,
} from './event-processors'
import { FightState } from './fight-state'
import { InterceptorTracker } from './interceptor-tracker'
import { defaultFightProcessorFactories } from './processors'
import { getActiveModifiers, getTotalMultiplier } from './utils'

const ENVIRONMENT_TARGET_ID = -1
const BOSS_MELEE_SPELL_ID = 1

interface PreparedThreatConfig {
  mergedAbilities: Record<number, ThreatFormula>
  mergedAuraModifiers: Record<number, (ctx: ThreatContext) => ThreatModifier>
  classModifiers: Partial<Record<WowClass, ThreatModifier>>
}

const preparedThreatConfigCache = new WeakMap<
  ThreatConfig,
  PreparedThreatConfig
>()

function capitalizeClassName(wowClass: WowClass): string {
  return wowClass.charAt(0).toUpperCase() + wowClass.slice(1)
}

function prepareThreatConfig(config: ThreatConfig): PreparedThreatConfig {
  const cached = preparedThreatConfigCache.get(config)
  if (cached) {
    return cached
  }

  const mergedAbilities: PreparedThreatConfig['mergedAbilities'] = {
    ...(config.abilities ?? {}),
  }
  const mergedAuraModifiers: PreparedThreatConfig['mergedAuraModifiers'] = {
    ...config.auraModifiers,
  }
  const classModifiers: PreparedThreatConfig['classModifiers'] = {}

  for (const [className, classConfig] of Object.entries(
    config.classes,
  ) as Array<[WowClass, ClassThreatConfig | undefined]>) {
    if (classConfig?.abilities) {
      Object.assign(mergedAbilities, classConfig.abilities)
    }

    if (classConfig?.auraModifiers) {
      Object.assign(mergedAuraModifiers, classConfig.auraModifiers)
    }

    if (
      classConfig?.baseThreatFactor !== undefined &&
      classConfig.baseThreatFactor !== 1
    ) {
      classModifiers[className] = {
        source: 'class',
        name: capitalizeClassName(className),
        value: classConfig.baseThreatFactor,
      }
    }
  }

  const prepared: PreparedThreatConfig = {
    mergedAbilities,
    mergedAuraModifiers,
    classModifiers,
  }
  preparedThreatConfigCache.set(config, prepared)

  return prepared
}

// ============================================================================
// Event Processing
// ============================================================================

export interface ProcessEventsInput {
  /** Raw WCL events from the API */
  rawEvents: WCLEvent[]
  /** Optional pre-seeded aura IDs keyed by friendly actor ID. */
  initialAurasByActor?: Map<number, readonly number[]>
  /** Map of actor IDs to actor metadata */
  actorMap: Map<number, Actor>
  /** Friendly actor IDs in the current fight (players + pets) */
  friendlyActorIds?: Set<number>
  /** Ability school bitmasks indexed by ability ID */
  abilitySchoolMap?: Map<number, number>
  /** List of all enemies in the fight */
  enemies: Enemy[]
  /** Encounter ID for encounter-scoped behavior */
  encounterId?: number | null
  /** Optional full report metadata for processor decisions. */
  report?: Report | null
  /** Optional fight metadata for processor decisions. */
  fight?: ReportFight | null
  /** Enable request-scoped threat-reduction minmax processors. */
  inferThreatReduction?: boolean
  /** Optional pre-resolved tank actor IDs for fight-scoped processors. */
  tankActorIds?: Set<number>
  /** Threat configuration for the game version */
  config: ThreatConfig
  /** Optional request-scoped event processors. */
  processors?: FightProcessor[]
}

export interface ProcessEventsOutput {
  /** Events augmented with threat calculations */
  augmentedEvents: AugmentedEvent[]
  /** Count of each event type processed */
  eventCounts: Record<string, number>
  /** Effective initial aura seeds used by the fight state. */
  initialAurasByActor: Map<number, number[]>
}

type FriendlyResolvedEvent = WCLEvent & {
  sourceIsFriendly: boolean
  targetIsFriendly: boolean
}

export interface ThreatEngineOptions {
  processorFactories?: FightProcessorFactory[]
}

/**
 * Class-based threat engine with built-in processor registry.
 */
export class ThreatEngine {
  private readonly processorFactories: FightProcessorFactory[]

  constructor(options: ThreatEngineOptions = {}) {
    this.processorFactories = [
      ...(options.processorFactories ?? defaultFightProcessorFactories),
    ]
  }

  /** Register a processor factory on this engine instance. */
  registerProcessorFactory(factory: FightProcessorFactory): this {
    this.processorFactories.push(factory)
    return this
  }

  /** Process a fight event stream and return augmented threat results. */
  processEvents(input: ProcessEventsInput): ProcessEventsOutput {
    const processorFactoryContext = {
      report: input.report ?? null,
      fight: input.fight ?? null,
      inferThreatReduction: input.inferThreatReduction ?? false,
      tankActorIds: input.tankActorIds,
    }
    const builtInProcessors = this.processorFactories.flatMap((factory) => {
      const processor = factory(processorFactoryContext)
      return processor ? [processor] : []
    })

    return processEventsWithProcessors({
      ...input,
      processors: [...builtInProcessors, ...(input.processors ?? [])],
    })
  }
}

const defaultThreatEngine = new ThreatEngine()

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
  return defaultThreatEngine.processEvents(input)
}

function processEventsWithProcessors(
  input: ProcessEventsInput,
): ProcessEventsOutput {
  const {
    rawEvents,
    initialAurasByActor,
    actorMap,
    friendlyActorIds,
    abilitySchoolMap,
    enemies,
    encounterId: inputEncounterId,
    report,
    fight,
    inferThreatReduction = false,
    tankActorIds,
    config,
    processors = [],
  } = input

  const normalizedInitialAurasByActor =
    normalizeInitialAurasByActor(initialAurasByActor)
  const processorNamespace = createProcessorNamespace()
  const processorBaseContext: ProcessorBaseContext = {
    namespace: processorNamespace,
    actorMap,
    friendlyActorIds,
    tankActorIds,
    enemies,
    encounterId: inputEncounterId ?? null,
    config,
    report: report ?? null,
    fight: fight ?? null,
    inferThreatReduction,
    initialAurasByActor: normalizedInitialAurasByActor,
  }
  runFightPrepass({
    rawEvents,
    processors,
    baseContext: processorBaseContext,
  })
  const effectiveInitialAurasByActor = mergeInitialAurasWithAdditions(
    normalizedInitialAurasByActor,
    processorNamespace.get(initialAuraAdditionsKey),
  )

  const fightState = new FightState(actorMap, config, enemies)
  seedInitialAuras(fightState, effectiveInitialAurasByActor)
  const interceptorTracker = new InterceptorTracker()
  const stateSpellSets = buildStateSpellSets(config)
  const augmentedEvents: AugmentedEvent[] = new Array(rawEvents.length)
  const eventCounts: Record<string, number> = {}
  const encounterId = toEncounterId(inputEncounterId)
  const encounterConfig = getEncounterConfig(config, encounterId)
  const preparedConfig = prepareThreatConfig(config)
  const validEnemies = enemies.filter(
    (enemy) => enemy.id !== ENVIRONMENT_TARGET_ID,
  )
  const encounterPreprocessor =
    encounterId !== null
      ? encounterConfig?.preprocessor?.({
          encounterId,
          enemies,
        })
      : undefined
  const storeAugmentedEvent = (
    eventIndex: number,
    augmentedEvent: AugmentedEvent,
  ): void => {
    augmentedEvents[eventIndex] = augmentedEvent
    // Release the original raw-event reference as we go to reduce peak memory.
    rawEvents[eventIndex] = augmentedEvent as WCLEvent
  }

  for (const [eventIndex, rawEvent] of rawEvents.entries()) {
    const event = resolveEventFriendliness({
      event: rawEvent,
      actorMap,
      friendlyActorIds,
    })
    const processorEffects: ThreatEffect[] = []
    const mainPassContext: MainPassEventContext = {
      ...processorBaseContext,
      event,
      eventIndex,
      fightState,
      effects: processorEffects,
      addEffects: (...effects) => {
        processorEffects.push(...effects)
      },
    }
    let appliedAuraMutationEffectIndex = 0

    processors.forEach((processor) => {
      processor.beforeFightState?.(mainPassContext)
    })

    // Update fight state (auras, gear, combatant info)
    fightState.processEvent(event, config)
    appliedAuraMutationEffectIndex = applyAuraMutationEffects(
      fightState,
      processorEffects,
      appliedAuraMutationEffectIndex,
    )
    processors.forEach((processor) => {
      processor.afterFightState?.(mainPassContext)
      appliedAuraMutationEffectIndex = applyAuraMutationEffects(
        fightState,
        processorEffects,
        appliedAuraMutationEffectIndex,
      )
    })

    // Count event types
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1

    if (isTrackedBossMeleeEvent(event)) {
      const bossMeleeEffects: ThreatEffect[] = [
        ...processorEffects,
        { type: 'eventMarker', marker: 'bossMelee' },
      ]
      const zeroCalculation: ThreatCalculation = {
        amount: event.amount,
        baseThreat: 0,
        modifiedThreat: 0,
        isSplit: false,
        modifiers: [],
        effects: toSerializableAugmentedEffects(bossMeleeEffects),
      }
      storeAugmentedEvent(
        eventIndex,
        buildAugmentedEvent(event, zeroCalculation, []),
      )
      continue
    }

    // Run event interceptors first
    const interceptorResults = interceptorTracker.runInterceptors(
      event,
      event.timestamp,
      fightState,
    )

    // Check if any interceptor wants to skip this event
    const shouldSkip = interceptorResults.some((r) => r.action === 'skip')
    if (shouldSkip) {
      const serializableProcessorEffects =
        toSerializableAugmentedEffects(processorEffects)
      // Create zero-threat augmented event
      const zeroCalculation: ThreatCalculation = {
        amount: 0,
        baseThreat: 0,
        modifiedThreat: 0,
        isSplit: false,
        modifiers: [],
        effects: serializableProcessorEffects,
      }
      storeAugmentedEvent(
        eventIndex,
        buildAugmentedEvent(event, zeroCalculation, []),
      )
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

    const sourceActor = resolveEventActor({
      actorId: event.sourceID,
      actorInstance: event.sourceInstance,
      actorMap,
      fightState,
    })
    const targetActor = resolveEventActor({
      actorId: event.targetID,
      actorInstance: event.targetInstance,
      actorMap,
      fightState,
    })

    const threatOptions: CalculateThreatOptions = {
      sourceAuras: fightState.getAurasForActor({
        id: event.sourceID,
        instanceId: event.sourceInstance,
      }),
      targetAuras: fightState.getAurasForActor({
        id: event.targetID,
        instanceId: event.targetInstance,
      }),
      spellSchoolMask: getSpellSchoolMaskForEvent(event, abilitySchoolMap),
      enemies,
      sourceActor,
      targetActor,
      encounterId,
      actors: fightState,
    }

    const threatContext = buildThreatContext(event, threatOptions)
    const baseCalculation = calculateModifiedThreat(
      event,
      threatOptions,
      config,
      preparedConfig,
    )

    const encounterEffects =
      encounterPreprocessor?.(threatContext)?.effects ?? []

    const stateEffect = buildStateEffectFromAuraEvent(event, stateSpellSets)
    const deathMarkerEffect = buildDeathEventMarker(event)
    const effects = [
      ...(baseCalculation?.effects ?? []),
      ...encounterEffects,
      ...interceptorEffects,
      ...processorEffects,
      ...(stateEffect ? [stateEffect] : []),
      ...(deathMarkerEffect ? [deathMarkerEffect] : []),
    ]
    const serializableEffects = toSerializableAugmentedEffects(effects)

    effects
      .filter((e) => e.type === 'installInterceptor')
      .forEach((effect) => {
        interceptorTracker.install(effect.interceptor, event.timestamp)
      })

    if (!baseCalculation && !serializableEffects) {
      storeAugmentedEvent(
        eventIndex,
        buildAugmentedEvent(event, undefined, undefined),
      )
      continue
    }

    const calculation: ThreatCalculation = baseCalculation
      ? {
          ...baseCalculation,
          effects: serializableEffects,
        }
      : {
          note: '(effects only)',
          amount: 0,
          baseThreat: 0,
          modifiedThreat: 0,
          isSplit: false,
          modifiers: [],
          effects: serializableEffects,
        }

    const changes = applyThreat(
      fightState,
      calculation,
      event,
      validEnemies,
      threatRecipientOverride,
    )

    storeAugmentedEvent(
      eventIndex,
      buildAugmentedEvent(
        event,
        calculation,
        changes.length > 0 ? changes : undefined,
      ),
    )
  }

  return {
    augmentedEvents,
    eventCounts,
    initialAurasByActor: effectiveInitialAurasByActor,
  }
}

function resolveEventActor({
  actorId,
  actorInstance,
  actorMap,
  fightState,
}: {
  actorId: number
  actorInstance: number | undefined
  actorMap: Map<number, Actor>
  fightState: FightState
}): Actor {
  const actorProfile = actorMap.get(actorId)
  if (actorProfile) {
    return actorProfile
  }

  const runtimeActor = fightState.getActor({
    id: actorId,
    instanceId: actorInstance,
  })
  if (runtimeActor) {
    return {
      id: runtimeActor.id,
      name: runtimeActor.name,
      class: runtimeActor.class,
    }
  }

  return {
    id: actorId,
    name: 'Unknown',
    class: null,
  }
}

function normalizeInitialAurasByActor(
  initialAurasByActor: Map<number, readonly number[]> | undefined,
): Map<number, readonly number[]> {
  if (!initialAurasByActor || initialAurasByActor.size === 0) {
    return new Map()
  }

  return new Map(
    [...initialAurasByActor.entries()].map(([actorId, auraIds]) => [
      actorId,
      [...new Set(auraIds)].sort((left, right) => left - right),
    ]),
  )
}

function seedInitialAuras(
  fightState: FightState,
  initialAurasByActor: Map<number, readonly number[]> | undefined,
): void {
  if (!initialAurasByActor || initialAurasByActor.size === 0) {
    return
  }

  for (const [actorId, auraIds] of initialAurasByActor.entries()) {
    for (const auraId of new Set(auraIds)) {
      fightState.setAura(actorId, auraId)
    }
  }
}

function applyAuraMutationEffects(
  fightState: FightState,
  effects: readonly ThreatEffect[],
  startIndex: number,
): number {
  for (let index = startIndex; index < effects.length; index += 1) {
    const effect = effects[index]
    if (!effect || effect.type !== 'auraMutation') {
      continue
    }

    const uniqueActorIds = [...new Set(effect.actorIds)]
    uniqueActorIds.forEach((actorId) => {
      if (effect.action === 'apply') {
        fightState.setAura(actorId, effect.spellId)
        return
      }

      fightState.removeAura(actorId, effect.spellId)
    })
  }

  return effects.length
}

/** Apply threat to relevant enemies in the fight state */
function applyThreat(
  fightState: FightState,
  calculation: ThreatCalculation,
  event: FriendlyResolvedEvent,
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

  const sourceRef = {
    id: event.sourceID,
    instanceId: event.sourceInstance ?? 0,
  }
  if (event.sourceIsFriendly && !fightState.isActorAlive(sourceRef)) {
    return changes
  }

  for (const effect of calculation.effects ?? []) {
    switch (effect.type) {
      case 'customThreat':
        changes.push(...applyCustomThreatEffect(fightState, effect))
        break
      case 'modifyThreat':
        changes.push(...applyModifyThreatEffect(fightState, effect, event))
        break
    }
  }

  // split threat among alive enemies only
  if (calculation.isSplit && calculation.modifiedThreat !== 0) {
    // Filter to alive enemies only
    const aliveEnemies = enemies.filter((e) =>
      fightState.isActorAlive({ id: e.id, instanceId: e.instance }),
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
    const threatTarget = resolveThreatTarget(event, enemies)
    if (!threatTarget) {
      return changes
    }

    const change = applyThreatDelta(
      fightState,
      threatRecipient,
      threatTarget.targetId,
      threatTarget.targetInstance,
      calculation.modifiedThreat,
    )
    if (change) {
      changes.push(change)
    }
  }
  return changes
}

function resolveThreatTarget(
  event: FriendlyResolvedEvent,
  enemies: Enemy[],
): { targetId: number; targetInstance: number } | null {
  if (event.type === 'absorbed' && typeof event.attackerID === 'number') {
    const matchedEnemy = enemies.find((enemy) => enemy.id === event.attackerID)
    if (matchedEnemy) {
      return {
        targetId: matchedEnemy.id,
        targetInstance: matchedEnemy.instance,
      }
    }
  }

  const targetInstance = event.targetInstance ?? 0
  const matchedEnemy = enemies.find(
    (enemy) => enemy.id === event.targetID && enemy.instance === targetInstance,
  )
  if (!matchedEnemy) {
    return null
  }

  return {
    targetId: matchedEnemy.id,
    targetInstance: matchedEnemy.instance,
  }
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
  return effect.changes.map((c) => fightState.applyChange(c))
}

/** Apply threat multipliers to either a single target or all actors on an enemy */
function applyModifyThreatEffect(
  fightState: FightState,
  effect: Extract<ThreatEffect, { type: 'modifyThreat' }>,
  event: FriendlyResolvedEvent,
): ThreatChange[] {
  if (effect.target === 'all') {
    // Friendly source abilities (e.g., Vanish, Feign Death):
    // modify this actor's threat against all enemies.
    if (event.sourceIsFriendly) {
      const actorId = event.sourceID
      const enemyThreatEntries = fightState.getAllEnemyThreatEntries(actorId)

      return enemyThreatEntries.map(({ enemy, threat }) => {
        const newThreat = calculateThreatModification(threat, effect.multiplier)
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
      const newThreat = calculateThreatModification(
        currentThreat,
        effect.multiplier,
      )
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
  const currentThreat = fightState.getThreat(event.targetID, {
    id: event.sourceID,
    instanceId: sourceEnemyInstance,
  })
  const newThreat = calculateThreatModification(
    currentThreat,
    effect.multiplier,
  )
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

function resolveFriendlyFlag({
  explicit,
  actorId,
  actorMap,
  friendlyActorIds,
}: {
  explicit: boolean | undefined
  actorId: number
  actorMap: Map<number, Actor>
  friendlyActorIds?: Set<number>
}): boolean {
  if (typeof explicit === 'boolean') {
    return explicit
  }

  if (friendlyActorIds) {
    return friendlyActorIds.has(actorId)
  }

  // Fallback for direct unit tests that pass only actorMap:
  // class-bearing actors are friendly players.
  const actor = actorMap.get(actorId)
  if (!actor) {
    return false
  }

  return actor.class !== null
}

function resolveEventFriendliness({
  event,
  actorMap,
  friendlyActorIds,
}: {
  event: WCLEvent
  actorMap: Map<number, Actor>
  friendlyActorIds?: Set<number>
}): FriendlyResolvedEvent {
  return {
    ...event,
    sourceIsFriendly: resolveFriendlyFlag({
      explicit: event.sourceIsFriendly,
      actorId: event.sourceID,
      actorMap,
      friendlyActorIds,
    }),
    targetIsFriendly: resolveFriendlyFlag({
      explicit: event.targetIsFriendly,
      actorId: event.targetID,
      actorMap,
      friendlyActorIds,
    }),
  }
}

function isTrackedBossMeleeEvent(
  event: FriendlyResolvedEvent,
): event is Extract<FriendlyResolvedEvent, { type: 'damage' }> {
  return (
    event.type === 'damage' &&
    event.abilityGameID === BOSS_MELEE_SPELL_ID &&
    !event.sourceIsFriendly &&
    event.targetIsFriendly
  )
}

function buildDeathEventMarker(
  event: FriendlyResolvedEvent,
): Extract<ThreatEffect, { type: 'eventMarker' }> | undefined {
  if (event.type !== 'death' || !event.targetIsFriendly) {
    return undefined
  }

  return {
    type: 'eventMarker',
    marker: 'death',
  }
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
  if (!('abilityGameID' in event) || typeof event.abilityGameID !== 'number') {
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

function isSerializableAugmentedEffect(effect: ThreatEffect): boolean {
  return effect.type !== 'installInterceptor'
}

function toSerializableAugmentedEffects(
  effects: readonly ThreatEffect[],
): ThreatEffect[] | undefined {
  if (effects.length === 0) {
    return undefined
  }

  const serializableEffects = effects.filter(isSerializableAugmentedEffect)
  return serializableEffects.length > 0 ? serializableEffects : undefined
}

function getAbilityName(event: WCLEvent): string | undefined {
  return 'abilityGameID' in event ? `Spell ${event.abilityGameID}` : undefined
}

/**
 * Build an augmented event from a WCL event and threat result
 */
function buildAugmentedEvent(
  event: WCLEvent,
  calculation?: ThreatCalculation,
  changes?: ThreatChange[] | undefined,
): AugmentedEvent {
  const base: AugmentedEvent = {
    timestamp: event.timestamp,
    type: event.type,
    sourceID: event.sourceID,
    targetID: event.targetID,
    sourceInstance: event.sourceInstance,
    targetInstance: event.targetInstance,
  }

  if (calculation) {
    // Add cumulative threat values from fight state
    const threatWithCumulative: ThreatResult = {
      calculation,
      changes,
    }
    base.threat = threatWithCumulative
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
  if ('attackerID' in event) {
    base.attackerID = event.attackerID
  }
  if ('extraAbilityGameID' in event) {
    base.extraAbilityGameID = event.extraAbilityGameID
  }
  if ('auras' in event) {
    base.auras = event.auras
  }
  if ('talents' in event) {
    base.talents = event.talents
  }

  if ('x' in event && 'y' in event) {
    base.x = event.x
    base.y = event.y
  }

  return base
}

// ============================================================================
// Threat Calculation
// ============================================================================

export interface CalculateThreatOptions {
  sourceAuras: ReadonlySet<SpellId>
  targetAuras: ReadonlySet<SpellId>
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
  preparedConfig: PreparedThreatConfig = prepareThreatConfig(config),
): ThreatCalculation | undefined {
  const ctx = buildThreatContext(event, options)

  // Get the threat formula result
  const formulaResult = getFormulaResult(ctx, config, preparedConfig)

  if (!formulaResult) {
    return
  }

  // Ability formulas can explicitly opt in/out of player multipliers.
  // Default keeps existing energize behavior (no multipliers) unless overridden.
  const shouldApplyPlayerMultipliers =
    formulaResult.applyPlayerMultipliers ??
    (event.type !== 'energize' && event.type !== 'resourcechange')
  const classModifiers = getAppliedClassModifier(
    options.sourceActor.class,
    preparedConfig,
  )
  const allModifiers: AppliedThreatModifier[] = shouldApplyPlayerMultipliers
    ? [...classModifiers, ...getAuraModifiers(ctx, preparedConfig)]
    : []

  // Calculate total multiplier
  const totalMultiplier = getTotalMultiplier(allModifiers)
  const modifiedThreat = formulaResult.value * totalMultiplier

  return {
    amount: ctx.amount,
    baseThreat: formulaResult.value,
    modifiedThreat: modifiedThreat,
    isSplit: formulaResult.splitAmongEnemies,
    spellModifier: formulaResult.spellModifier,
    note: formulaResult.note,
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
    case 'absorbed':
      return event.amount
    case 'heal': {
      // Only effective healing generates threat (exclude overheal)
      const overheal = 'overheal' in event ? event.overheal : 0
      return Math.max(0, event.amount - overheal)
    }
    case 'energize':
    case 'resourcechange':
      // Only actual resource gained generates threat (exclude waste)
      return Math.max(0, (event.resourceChange ?? 0) - (event.waste ?? 0))
    default:
      return 0
  }
}

/**
 * Get the formula result for an event
 */
function getFormulaResult(
  ctx: ThreatContext,
  config: ThreatConfig,
  preparedConfig: PreparedThreatConfig,
) {
  const event = ctx.event

  // Resolve ability formulas from one flattened map:
  // global abilities + all class abilities (class entries overwrite globals).
  if ('abilityGameID' in event && typeof event.abilityGameID === 'number') {
    const abilityFormula = preparedConfig.mergedAbilities[event.abilityGameID]
    if (abilityFormula) {
      // Ability formulas override base formulas; undefined means this phase has no threat.
      return abilityFormula(ctx)
    }
  }

  // Fall back to base threat formulas by event type
  switch (event.type) {
    case 'damage':
      return config.baseThreat.damage(ctx)
    case 'absorbed':
      return config.baseThreat.absorbed(ctx)
    case 'heal':
      return config.baseThreat.heal(ctx)
    case 'energize':
    case 'resourcechange':
      return config.baseThreat.energize(ctx)
    default:
      return
  }
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
function getAppliedClassModifier(
  wowClass: WowClass | null,
  preparedConfig: PreparedThreatConfig,
): AppliedThreatModifier[] {
  if (!wowClass) {
    return []
  }

  return preparedConfig.classModifiers[wowClass]
    ? [{ ...preparedConfig.classModifiers[wowClass], sourceId: undefined }]
    : []
}

/**
 * Get all active aura modifiers (global + all classes)
 * This allows cross-class buffs (e.g., Blessing of Salvation) to apply to any actor.
 * The game validates which buffs can be applied, so we merge everything and let
 * the sourceAuras set determine which modifiers actually apply.
 */
function getAuraModifiers(
  ctx: ThreatContext,
  preparedConfig: PreparedThreatConfig,
): AppliedThreatModifier[] {
  // Apply the merged aura modifiers based on active auras
  return getActiveModifiers(ctx, preparedConfig.mergedAuraModifiers)
}
