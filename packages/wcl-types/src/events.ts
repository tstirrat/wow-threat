/**
 * WCL Event Types
 * These types mirror the event data returned by WCL GraphQL API
 */

export type EventType =
  | 'damage'
  | 'heal'
  | 'applybuff'
  | 'removebuff'
  | 'applydebuff'
  | 'removedebuff'
  | 'energize'
  | 'cast'
  | 'begincast'
  | 'interrupt'
  | 'death'
  | 'resurrect'
  | 'summon'
  | 'combatantinfo'

export type HitType =
  | 'hit'
  | 'crit'
  | 'miss'
  | 'dodge'
  | 'parry'
  | 'block'
  | 'glancing'
  | 'crushing'
  | 'immune'
  | 'resist'
  | 'absorb'

export type ResourceType =
  | 'mana'
  | 'rage'
  | 'energy'
  | 'runic_power'
  | 'combo_points'
  | 'focus'
  | 'holy_power'

export interface Ability {
  guid: number
  name: string
  type: number // School (1=Physical, 2=Holy, etc.)
  abilityIcon: string
}

/** Base fields present on all WCL events */
export interface BaseWCLEvent {
  timestamp: number // Relative to fight start (ms)
  type: EventType
  sourceID: number
  sourceIsFriendly: boolean
  targetID: number
  targetIsFriendly: boolean
  sourceInstance?: number // For multi-instance enemies
  targetInstance?: number
}

export interface DamageEvent extends BaseWCLEvent {
  type: 'damage'
  abilityGameID: number
  amount: number
  absorbed: number
  blocked: number
  mitigated: number
  overkill: number
  hitType: HitType
  tick: boolean // DoT tick
  multistrike: boolean
}

export interface HealEvent extends BaseWCLEvent {
  type: 'heal'
  abilityGameID: number
  amount: number
  absorbed: number // Absorbed healing
  overheal: number
  tick: boolean // HoT tick
}

export interface ApplyBuffEvent extends BaseWCLEvent {
  type: 'applybuff'
  abilityGameID: number
  absorb?: number // Initial absorb shield amount
  stacks?: number
}

export interface RemoveBuffEvent extends BaseWCLEvent {
  type: 'removebuff'
  abilityGameID: number
  absorb?: number // Remaining absorb when removed
  stacks?: number
}

export interface ApplyDebuffEvent extends BaseWCLEvent {
  type: 'applydebuff'
  abilityGameID: number
  stacks?: number
}

export interface RemoveDebuffEvent extends BaseWCLEvent {
  type: 'removedebuff'
  abilityGameID: number
  stacks?: number
}

export interface EnergizeEvent extends BaseWCLEvent {
  type: 'energize'
  abilityGameID: number
  resourceChange: number
  resourceChangeType: ResourceType
  waste: number
}

export interface CastEvent extends BaseWCLEvent {
  type: 'cast'
  abilityGameID: number
}

export interface BeginCastEvent extends BaseWCLEvent {
  type: 'begincast'
  abilityGameID: number
}

export interface InterruptEvent extends BaseWCLEvent {
  type: 'interrupt'
  abilityGameID: number
  extraAbility?: Ability // The interrupted ability
}

export interface DeathEvent extends BaseWCLEvent {
  type: 'death'
  abilityGameID?: number // Killing blow ability
  killerID?: number
}

export interface ResurrectEvent extends BaseWCLEvent {
  type: 'resurrect'
  abilityGameID: number
}

export interface SummonEvent extends BaseWCLEvent {
  type: 'summon'
  abilityGameID: number
}

// ======================================================================
// Combatant Info Types
// ======================================================================

/** A single equipped item from WCL combatant info */
export interface GearItem {
  id: number
  setID?: number
  temporaryEnchant?: number
  permanentEnchant?: number
}

/** Aura snapshot from combatant info at fight start */
export interface CombatantInfoAura {
  source: number
  ability: number
  stacks: number
  icon: string
  name: string
}

export interface CombatantInfoEvent extends BaseWCLEvent {
  type: 'combatantinfo'
  gear?: GearItem[]
  auras?: CombatantInfoAura[]
  talents?: unknown[]
  specID?: number
}

/** Union type for WCL events */
export type WCLEvent =
  | DamageEvent
  | HealEvent
  | ApplyBuffEvent
  | RemoveBuffEvent
  | ApplyDebuffEvent
  | RemoveDebuffEvent
  | EnergizeEvent
  | CastEvent
  | BeginCastEvent
  | InterruptEvent
  | DeathEvent
  | ResurrectEvent
  | SummonEvent
  | CombatantInfoEvent
