/**
 * Threat Configuration Types
 *
 * These types define the structure of threat calculation configurations
 * for different game versions.
 */
import type {
  EventType,
  GearItem,
  HitType,
  ResourceType,
  WCLEvent,
} from '@wcl-threat/wcl-types'

export type { GearItem }

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

export type SpellSchool =
  | 'physical'
  | 'holy'
  | 'fire'
  | 'nature'
  | 'frost'
  | 'shadow'
  | 'arcane'

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
  /** Get position of an actor (null if not available) */
  getPosition: (actorId: number) => { x: number; y: number } | null
  /** Calculate distance between two actors (null if positions unavailable) */
  getDistance: (actorId1: number, actorId2: number) => number | null
  /** Get actors within range of a position */
  getActorsInRange: (actorId: number, maxDistance: number) => number[]
  /** Get current threat for an actor against an enemy */
  getThreat: (actorId: number, enemyId: number) => number
  /** Get top N actors by threat against an enemy */
  getTopActorsByThreat: (
    enemyId: number,
    count: number,
  ) => Array<{ actorId: number; threat: number }>
  /** Check if an actor is alive (false if dead or not tracked) */
  isActorAlive: (actorId: number) => boolean
}

export interface ThreatContext {
  /** The WCL event being processed */
  event: WCLEvent
  /** The primary amount (damage/heal/resource) */
  amount: number
  /** Active auras on the source actor (spell IDs) */
  sourceAuras: Set<number>
  /** Active auras on the target actor (spell IDs) */
  targetAuras: Set<number>
  /** The source actor of the event */
  sourceActor: Actor
  /** The target actor of the event */
  targetActor: Actor
  /** Encounter ID if this is a boss fight */
  encounterId: number | null
  /** Access to actor positions and threat state */
  actors: ActorContext
}

export interface Actor {
  id: number
  name: string
  class: WowClass | null
}

export interface Enemy {
  id: number
  name: string
  instance: number
}

export interface ThreatModifier {
  source: ModifierSource
  name: string
  spellIds?: Set<number>
  /** Multiplier value, e.g., 1.3 */
  value: number
  /** If specified, modifier only applies to these spell schools. Omit for all schools. */
  schools?: Set<SpellSchool>
}

// ============================================================================
// Effect Handler System
// ============================================================================

/**
 * Context provided to effect handlers when they intercept events
 */
export interface EffectHandlerContext {
  /** Current event timestamp */
  timestamp: number
  /** Timestamp when this handler was installed */
  installedAt: number
  /** Access to actor state (positions, threat, auras) */
  actors: ActorContext
  /** Uninstall this handler (call when effect expires) */
  uninstall: () => void
}

/**
 * Result returned by an effect handler after intercepting an event
 */
export type EffectHandlerResult =
  | { action: 'passthrough' }
  | { action: 'skip' }
  | {
      action: 'augment'
      /** Override who receives threat credit (e.g., Misdirection) */
      threatRecipientOverride?: number
      /** Additional special behavior to apply */
      special?: ThreatSpecial
    }

/**
 * Handler function that intercepts future events
 * Installed by abilities to implement deferred effects (Misdirection, delayed threat drops, etc.)
 */
export type EffectHandler = (
  event: WCLEvent,
  ctx: EffectHandlerContext,
) => EffectHandlerResult

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

export type ThreatSpecial =
  | { type: 'modifyThreat'; multiplier: number; target: 'target' | 'all' }
  | { type: 'state'; state: ThreatStatePayload }
  | { type: 'customThreat'; changes: ThreatChange[] }
  | { type: 'installHandler'; handler: EffectHandler }

export interface ThreatFormulaResult {
  /** Human-readable formula, e.g., "(2 * amt) + 115" */
  formula: string
  /** Threat value to apply to the target */
  value: number
  /** Whether to divide threat among all enemies */
  splitAmongEnemies: boolean
  /** Special behaviors (taunt, threat drop, custom threat, etc.) */
  special?: ThreatSpecial
}

/** Threat formula function signature */
export type ThreatFormula = (ctx: ThreatContext) => ThreatFormulaResult

// ============================================================================
// Configuration Structures
// ============================================================================

export interface BaseThreatConfig {
  damage: ThreatFormula
  heal: ThreatFormula
  energize: ThreatFormula
}

export type AuraModifierFn = (ctx: ThreatContext) => ThreatModifier

export interface ClassThreatConfig {
  /** Exclusive aura sets - engine auto-removes others when one is applied */
  exclusiveAuras?: Set<number>[]

  /** Base threat factor for the class (default: 1.0) */
  baseThreatFactor?: number

  /** Aura-based modifiers: spellId -> modifier function */
  auraModifiers: Record<number, AuraModifierFn>

  /** Ability-specific formulas */
  abilities: Record<number, ThreatFormula>

  /** Called when combatantInfo is received to detect gear-based modifiers */
  gearImplications?: (gear: GearItem[]) => number[]

  /** Buffs that indicate fixate (taunt) state */
  fixateBuffs?: Set<number>
  /** Buffs that indicate aggro loss state */
  aggroLossBuffs?: Set<number>
  /** Buffs that indicate invulnerability */
  invulnerabilityBuffs?: Set<number>
}

export interface ThreatConfig {
  /** Semantic version of this config */
  version: string
  /** WCL gameVersion integer */
  gameVersion: number
  /** Base threat calculations by event type */
  baseThreat: BaseThreatConfig
  /** Class-specific configurations */
  classes: Partial<Record<WowClass, ClassThreatConfig>>
  /**
   * Global aura modifiers (items, consumables, cross-class buffs).
   * Merged with all class aura modifiers at runtime and applied based on which
   * auras the source actor has active.
   */
  auraModifiers: Record<number, (ctx: ThreatContext) => ThreatModifier>
  /** Buffs that indicate fixate (taunt) state */
  fixateBuffs?: Set<number>
  /** Buffs that indicate aggro loss state */
  aggroLossBuffs?: Set<number>
  /** Buffs that indicate invulnerability */
  invulnerabilityBuffs?: Set<number>
  /** Global ability overrides (boss mechanics, etc.) - checked before class abilities */
  abilities?: Record<number, ThreatFormula>
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
  modifiers: ThreatModifier[]
  /** Special behaviors (taunt, threat drop, custom threat, etc.) */
  special?: ThreatSpecial
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
  sourceIsFriendly: boolean
  targetID: number
  targetIsFriendly: boolean
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

  /** Augmented threat data */
  threat: ThreatResult
}
