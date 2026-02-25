/**
 * Threat Configuration Types
 *
 * These types define the structure of threat calculation configurations
 * for different game versions.
 */
import type {
  CombatantInfoAura,
  CombatantInfoEvent,
  EventType,
  GearItem,
  HitType,
  ResourceType,
  TalentPoints,
  WCLEvent,
} from '@wow-threat/wcl-types'

// ============================================================================
// Core Types
// ============================================================================

export type WowClass =
  | 'warrior'
  | 'paladin'
  | 'hunter'
  | 'rogue'
  | 'priest'
  | 'shaman'
  | 'mage'
  | 'warlock'
  | 'druid'
  | 'deathknight'
  | 'monk'
  | 'demonhunter'
  | 'evoker'

// TODO: Promote SpellId to a branded/tagged type for stronger compile-time safety.
export type SpellId = number
export type EncounterId = number & { readonly __brand: 'EncounterId' }

export enum SpellSchool {
  Physical = 1,
  Holy = 2,
  Fire = 4,
  Nature = 8,
  Frost = 16,
  Shadow = 32,
  Arcane = 64,
}

export type ModifierSource =
  | 'class' // Class-inherent modifier (e.g., Bear Form)
  | 'talent' // Talent choice
  | 'buff' // Active buff on source
  | 'debuff' // Debuff on target enemy
  | 'gear' // Set bonus, item effect
  | 'stance' // Defensive Stance, Righteous Fury, etc.
  | 'aura' // Raid/party buff affecting threat

// ============================================================================
// Threat Context & Results
// ============================================================================

/**
 * Actor state accessors for threat formulas
 * Provides access to position and threat tracking during threat calculations
 */
export interface ActorContext {
  /** Actor reference that may include a specific instance */
  // Using object refs prevents accidental argument order swaps.
  // Example: { id: 25, instanceId: 2 }
  //
  // instanceId defaults to 0 when omitted.
  getPosition: (actor: ActorRef) => { x: number; y: number } | null
  /** Get a read-only runtime actor snapshot (metadata + tracked state). */
  getActor?: (actor: ActorRef) => RuntimeActorView | null
  /** Calculate distance between two actors (null if positions unavailable) */
  getDistance: (actor1: ActorRef, actor2: ActorRef) => number | null
  /** Get actors within range of a position */
  getActorsInRange: (actor: ActorRef, maxDistance: number) => number[]
  /** Get current threat for an actor against an enemy */
  getThreat: (actorId: number, enemy: EnemyRef) => number
  /** Get top N actors by threat against an enemy */
  getTopActorsByThreat: (
    enemy: EnemyRef,
    count: number,
  ) => Array<{ actorId: number; threat: number }>
  /** Get enemy references in the current fight */
  getFightEnemies: () => EnemyRef[]
  /** Check if an actor is alive (false if dead or not tracked) */
  isActorAlive: (actor: ActorRef) => boolean
  /** Get the actor's current target (with instance), if known */
  getCurrentTarget: (
    actor: ActorRef,
  ) => { targetId: number; targetInstance: number } | null
  /** Get the actor's previously tracked target (with instance), if known */
  getLastTarget: (
    actor: ActorRef,
  ) => { targetId: number; targetInstance: number } | null
}

export interface ActorRef {
  id: number
  instanceId?: number
}

export interface EnemyRef {
  id: number
  instanceId?: number
}

export interface ThreatContext {
  /** The WCL event being processed */
  event: WCLEvent
  /** The primary amount (damage/heal/resource) */
  amount: number
  /** WCL spell-school bitmask for the event ability (0 when school is unknown) */
  spellSchoolMask: number
  /** Active auras on the source actor (spell IDs) */
  sourceAuras: ReadonlySet<number>
  /** Active auras on the target actor (spell IDs) */
  targetAuras: ReadonlySet<number>
  /** The source actor of the event */
  sourceActor: Actor
  /** The target actor of the event */
  targetActor: Actor
  /** Encounter ID if this is a boss fight */
  encounterId: EncounterId | null
  /** Access to actor positions and threat state */
  actors: ActorContext
}

export interface Actor {
  id: number
  name: string
  class: WowClass | null
  /** Owning actor ID when this actor is a pet. */
  petOwner?: number | null
}

/** Read-only runtime actor view exposed to formulas/interceptors. */
export interface RuntimeActorView {
  readonly id: number
  readonly instanceId: number
  readonly name: string
  readonly class: WowClass | null
  readonly alive: boolean
  readonly position: Readonly<{ x: number; y: number }> | null
  readonly currentTarget: Readonly<{
    targetId: number
    targetInstance: number
  }> | null
  readonly lastTarget: Readonly<{
    targetId: number
    targetInstance: number
  }> | null
  readonly auras: ReadonlySet<number>
}

export interface Enemy {
  id: number
  name: string
  instance: number
}

/** A modifier that can be applied to threat calculations */
export interface ThreatModifier {
  source: ModifierSource
  name: string
  /** If specified, modifier only applies when event abilityGameID is in this set. */
  spellIds?: Set<number>
  /** Multiplier value, e.g., 1.3 */
  value: number
  /** If specified, restricts modifier to events whose school intersects this bitmask. */
  schoolMask?: number
}

/** A threat modifier that has been applied to an event (with sourceId) */
export interface AppliedThreatModifier extends ThreatModifier {
  /** The spell ID that applied this modifier. */
  sourceId: SpellId | undefined
}

// ============================================================================
// Event Interceptor System
// ============================================================================

/**
 * Context provided to event interceptors when they intercept events
 */
export interface EventInterceptorContext {
  /** Current event timestamp */
  timestamp: number
  /** Timestamp when this interceptor was installed */
  installedAt: number
  /** Access to actor state (positions, threat, auras) */
  actors: ActorContext
  /** Uninstall this interceptor (call when effect expires) */
  uninstall: () => void
  /** Ensure an aura is active on an actor (enforces exclusive aura eviction) */
  setAura: (actorId: number, spellId: number) => void
  /** Remove an aura from an actor */
  removeAura: (actorId: number, spellId: number) => void
}

/**
 * Result returned by an event interceptor after intercepting an event
 */
export type EventInterceptorResult =
  | { action: 'passthrough' }
  | { action: 'skip' }
  | {
      action: 'augment'
      /** Override who receives threat credit (e.g., Misdirection) */
      threatRecipientOverride?: number
      /** Additional effects to apply */
      effects?: ThreatEffect[]
    }

/**
 * Interceptor function that intercepts future events
 * Installed by abilities to implement deferred effects (Misdirection, delayed threat drops, etc.)
 */
export type EventInterceptor = (
  event: WCLEvent,
  ctx: EventInterceptorContext,
) => EventInterceptorResult

export type ThreatStateKind = 'fixate' | 'aggroLoss' | 'invulnerable'
export type ThreatStatePhase = 'start' | 'end'

export interface ThreatStatePayload {
  kind: ThreatStateKind
  phase: ThreatStatePhase
  spellId: number
  actorId: number
  targetId?: number
  targetInstance?: number
  name?: string
}

export type ThreatEffect =
  | { type: 'modifyThreat'; multiplier: number; target: 'target' | 'all' }
  | {
      type: 'auraMutation'
      action: 'apply' | 'remove'
      spellId: number
      actorIds: number[]
    }
  | { type: 'state'; state: ThreatStatePayload }
  | { type: 'eventMarker'; marker: 'bossMelee' | 'death' }
  | { type: 'customThreat'; changes: ThreatChange[] }
  | { type: 'installInterceptor'; interceptor: EventInterceptor }

export interface ThreatFormulaResult {
  /** Human-readable formula, e.g., "(2 * amt) + 115" */
  formula: string
  /** Threat value to apply to the target */
  value: number
  /** Whether to divide threat among all enemies */
  splitAmongEnemies: boolean
  /** Whether to apply player multipliers (class/aura/talent). Defaults to true. */
  applyPlayerMultipliers?: boolean
  /** Event effects (taunt, threat drop, custom threat, etc.) */
  effects?: ThreatEffect[]
}

/** Threat formula function signature */
export type ThreatFormula = (
  ctx: ThreatContext,
) => ThreatFormulaResult | undefined

// ============================================================================
// Configuration Structures
// ============================================================================

export interface BaseThreatConfig {
  damage: ThreatFormula
  absorbed: ThreatFormula
  heal: ThreatFormula
  energize: ThreatFormula
}

export type AuraModifierFn = (ctx: ThreatContext) => ThreatModifier
export interface TalentImplicationContext {
  event: CombatantInfoEvent
  sourceActor: Actor | null
  talentPoints: number[]
  talentRanks: ReadonlyMap<number, number>
  specId: number | null
}

export type TalentImplicationsFn = (ctx: TalentImplicationContext) => number[]

export type AuraImplications = ReadonlyMap<SpellId, ReadonlySet<SpellId>>

export type AuraModifiers = Record<number, AuraModifierFn>

export type Abilities = Record<number, ThreatFormula>

export interface ClassThreatConfig {
  /** Exclusive aura sets - engine auto-removes others when one is applied */
  exclusiveAuras?: Set<number>[]

  /** Base threat factor for the class (default: 1.0) */
  baseThreatFactor?: number

  /** Aura-based modifiers: spellId -> modifier function */
  auraModifiers: AuraModifiers
  abilities: Abilities
  gearImplications?: (gear: GearItem[]) => number[]

  /** Called when combatantInfo is received to detect talent-based synthetic auras */
  talentImplications?: TalentImplicationsFn

  /** Implied aura state keyed by aura spell ID -> cast spell IDs that imply it */
  auraImplications?: AuraImplications

  /**
   * Implied aura state keyed by owner aura spell ID -> ability spell IDs that imply it.
   *
   * These implications apply when:
   * - the owner casts the matching ability (e.g. summon spell), or
   * - one of the owner's pets uses the matching ability.
   */
  petAuraImplications?: AuraImplications

  /** Buffs that indicate fixate (taunt) state */
  fixateBuffs?: Set<number>
  /** Buffs that indicate aggro loss state */
  aggroLossBuffs?: Set<number>
  /** Buffs that indicate invulnerability */
  invulnerabilityBuffs?: Set<number>
}

export interface EncounterPreprocessorContext {
  encounterId: EncounterId
  enemies: Enemy[]
}

export interface EncounterPreprocessorResult {
  /** Attach encounter-level effects to the current event */
  effects?: ThreatEffect[]
}

export type EncounterPreprocessor = (
  ctx: ThreatContext,
) => EncounterPreprocessorResult | undefined

export type EncounterPreprocessorFactory = (
  ctx: EncounterPreprocessorContext,
) => EncounterPreprocessor

export interface EncounterThreatConfig {
  /** Optional per-event preprocessing hook for this encounter */
  preprocessor?: EncounterPreprocessorFactory
}

export interface ThreatConfigResolutionReport {
  startTime: number
  masterData: {
    gameVersion: number
  }
  zone: {
    partitions?: Array<{
      id: number
      name: string
    }>
  }
  fights: Array<{
    classicSeasonID?: number | null
  }>
}

export interface ThreatConfigResolutionInput {
  report: ThreatConfigResolutionReport
}

export interface WowheadConfig {
  /** Shared Wowhead domain used for links and tooltip payloads. */
  domain: string
}

export interface ThreatConfig {
  /** Semantic version of this config */
  version: string
  /** Human-readable config label, e.g. "Season of Discovery" */
  displayName: string
  /** Wowhead link + tooltip domain config for this game branch. */
  wowhead: WowheadConfig
  /** Report metadata matcher used to select this config */
  resolve: (input: ThreatConfigResolutionInput) => boolean
  /** Base threat calculations by event type */
  baseThreat: BaseThreatConfig
  /** Class-specific configurations */
  classes: Partial<Record<WowClass, ClassThreatConfig>>
  /**
   * Global aura modifiers (items, consumables, cross-class buffs).
   * Merged with all class aura modifiers at runtime and applied based on which
   * auras the source actor has active.
   */
  auraModifiers: Record<number, AuraModifierFn>
  /** Called for all classes when combatantInfo is received to detect gear-based modifiers */
  gearImplications?: (gear: GearItem[]) => number[]
  /** Buffs that indicate fixate (taunt) state */
  fixateBuffs?: Set<number>
  /** Buffs that indicate aggro loss state */
  aggroLossBuffs?: Set<number>
  /** Buffs that indicate invulnerability */
  invulnerabilityBuffs?: Set<number>
  /** Global ability overrides (boss mechanics, etc.) - checked before class abilities */
  abilities?: Record<number, ThreatFormula>
  /** Encounter-scoped overrides and preprocessors keyed by encounter ID */
  encounters?: Record<EncounterId, EncounterThreatConfig>
}

// ============================================================================
// Augmented Event Types (API Response)
// ============================================================================

export type ThreatChangeOperator = 'add' | 'set'

export interface ThreatChange {
  sourceId: number
  targetId: number
  targetInstance: number
  operator: ThreatChangeOperator
  amount: number
  total: number
}

export interface ThreatCalculation {
  /** The base threat formula */
  formula: string
  /** Event amount (damage/heal/etc.) - for reference */
  amount: number
  /** Result of formula applied to baseValue */
  baseThreat: number
  /** Final threat (before splitting) */
  modifiedThreat: number
  /** Whether threat was split among multiple enemies */
  isSplit: boolean
  /** Modifiers applied (multiplicative with each other) */
  modifiers: AppliedThreatModifier[]
  /** Event effects (taunt, threat drop, custom threat, etc.) */
  effects?: ThreatEffect[]
}

export interface ThreatResult {
  /** Threat applied to each enemy */
  changes?: ThreatChange[]
  /** Calculation breakdown for debugging/tooltips */
  calculation: ThreatCalculation
}

export interface AugmentedEvent {
  /** Original WCL event data */
  timestamp: number
  type: EventType
  sourceID: number
  targetID: number
  sourceInstance?: number
  targetInstance?: number
  abilityGameID?: number

  /** Event-specific fields preserved from WCL */
  amount?: number
  absorbed?: number
  blocked?: number
  mitigated?: number
  overkill?: number
  overheal?: number
  hitType?: HitType
  tick?: boolean
  resourceChange?: number
  resourceChangeType?: ResourceType
  waste?: number
  stacks?: number
  killerID?: number
  attackerID?: number
  extraAbilityGameID?: number
  auras?: CombatantInfoAura[]
  talents?: TalentPoints

  x?: number
  y?: number

  /** Augmented threat data (present only when event is threat-relevant) */
  threat?: ThreatResult
}
