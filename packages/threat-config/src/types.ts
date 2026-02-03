/**
 * Threat Configuration Types
 *
 * These types define the structure of threat calculation configurations
 * for different game versions.
 */

import type { WCLEvent, Ability, GearItem } from '@wcl-threat/wcl-types'

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

export interface ThreatContext {
  /** The WCL event being processed */
  event: WCLEvent
  /** The primary amount (damage/heal/resource) */
  amount: number
  /** Active auras on the source actor (spell IDs) */
  sourceAuras: Set<number>
  /** Active auras on the target actor (spell IDs) */
  targetAuras: Set<number>
  /** All enemies in the fight */
  enemies: Enemy[]
  /** The source actor of the event */
  sourceActor: Actor
  /** The target actor of the event */
  targetActor: Actor
  /** Encounter ID if this is a boss fight */
  encounterId: number | null
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

export type ThreatSpecial =
  | { type: 'taunt'; fixateDuration: number }
  | { type: 'threatDrop' }
  | { type: 'noThreatWindow'; duration: number }
  | { type: 'fixate' }
  | { type: 'fixateEnd' }
  | { type: 'aggroLoss' }
  | { type: 'aggroLossEnd' }
  | { type: 'invulnerable' }
  | { type: 'invulnerableEnd' }

export interface ThreatFormulaResult {
  /** Human-readable formula, e.g., "(2 * amt) + 115" */
  formula: string
  /** Result of applying formula to amount */
  baseThreat: number
  /** Additional modifiers to apply */
  modifiers: ThreatModifier[]
  /** Whether to divide threat among all enemies */
  splitAmongEnemies: boolean
  /** Special behaviors (taunt, threat drop, etc.) */
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

export interface ClassThreatConfig {
  /** Exclusive aura sets - engine auto-removes others when one is applied */
  exclusiveAuras?: Set<number>[]

  /** Base threat factor for the class (default: 1.0) */
  baseThreatFactor?: number


  /** Aura-based modifiers: spellId -> modifier function */
  auraModifiers: Record<number, (ctx: ThreatContext) => ThreatModifier>

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
  /** Enemies that cannot be taunted (by creature guid) */
  untauntableEnemies: Set<number>
  /** Buffs that indicate fixate (taunt) state */
  fixateBuffs?: Set<number>
  /** Buffs that indicate aggro loss state */
  aggroLossBuffs?: Set<number>
  /** Buffs that indicate invulnerability */
  invulnerabilityBuffs?: Set<number>
}

// ============================================================================
// Augmented Event Types (API Response)
// ============================================================================

export interface ThreatValue {
  enemyId: number
  enemyInstance: number
  amount: number
  isSplit: boolean
}

export interface ThreatCalculation {
  /** The base threat formula */
  formula: string
  /** Event amount (damage/heal/etc.) - for reference */
  baseValue: number
  /** Result of formula applied to baseValue */
  baseThreat: number
  /** Final threat per enemy after all modifiers and splitting */
  threatToEnemy: number
  /** Modifiers applied (multiplicative with each other) */
  modifiers: ThreatModifier[]
}

export interface ThreatResult {
  /** Threat applied to each enemy */
  values: ThreatValue[]
  /** Calculation breakdown for debugging/tooltips */
  calculation: ThreatCalculation
}

export interface AugmentedEvent {
  /** Original WCL event data */
  timestamp: number
  type: string
  sourceID: number
  sourceIsFriendly: boolean
  targetID: number
  targetIsFriendly: boolean
  sourceInstance?: number
  targetInstance?: number
  ability?: Ability

  /** Event-specific fields preserved from WCL */
  amount?: number
  absorbed?: number
  blocked?: number
  mitigated?: number
  overkill?: number
  overheal?: number
  hitType?: string
  tick?: boolean

  /** Augmented threat data */
  threat: ThreatResult
}
