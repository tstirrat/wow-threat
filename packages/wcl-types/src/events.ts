/**
 * WCL Event Types
 * These types mirror the event data returned by WCL GraphQL API
 */

export type EventType =
  | 'damage'
  | 'heal'
  | 'applybuff'
  | 'refreshbuff'
  | 'applybuffstack'
  | 'removebuff'
  | 'removebuffstack'
  | 'applydebuff'
  | 'refreshdebuff'
  | 'applydebuffstack'
  | 'removedebuff'
  | 'removedebuffstack'
  | 'energize'
  | 'resourcechange'
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
  targetID: number
  sourceInstance?: number // For multi-instance enemies
  targetInstance?: number
  x?: number // X coordinate (requires includeResources: true in query)
  y?: number // Y coordinate (requires includeResources: true in query)
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

export interface RefreshBuffEvent extends BaseWCLEvent {
  type: 'refreshbuff'
  abilityGameID: number
  absorb?: number
  stacks?: number
}

export interface ApplyBuffStackEvent extends BaseWCLEvent {
  type: 'applybuffstack'
  abilityGameID: number
  absorb?: number
  stacks?: number
}

export interface RemoveBuffEvent extends BaseWCLEvent {
  type: 'removebuff'
  abilityGameID: number
  absorb?: number // Remaining absorb when removed
  stacks?: number
}

export interface RemoveBuffStackEvent extends BaseWCLEvent {
  type: 'removebuffstack'
  abilityGameID: number
  absorb?: number
  stacks?: number
}

export interface ApplyDebuffEvent extends BaseWCLEvent {
  type: 'applydebuff'
  abilityGameID: number
  stacks?: number
}

export interface RefreshDebuffEvent extends BaseWCLEvent {
  type: 'refreshdebuff'
  abilityGameID: number
  stacks?: number
}

export interface ApplyDebuffStackEvent extends BaseWCLEvent {
  type: 'applydebuffstack'
  abilityGameID: number
  stacks?: number
}

export interface RemoveDebuffEvent extends BaseWCLEvent {
  type: 'removedebuff'
  abilityGameID: number
  stacks?: number
}

export interface RemoveDebuffStackEvent extends BaseWCLEvent {
  type: 'removedebuffstack'
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

export interface ResourceChangeEvent extends BaseWCLEvent {
  type: 'resourcechange'
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
  ability?: number // Verified at the API level that this is ability and not abilityGameID
  stacks: number
  icon: string
  name?: string | null
}

export interface TalentPoint {
  id: number
  icon: string
}

export type TalentPoints = readonly [TalentPoint, TalentPoint, TalentPoint]

export interface CombatantInfoEvent extends BaseWCLEvent {
  type: 'combatantinfo'
  gear?: GearItem[]
  auras?: CombatantInfoAura[]
  talents?: TalentPoints
  talentRows?: number[]
  talentTree?: unknown[]
  specID?: number
  specId?: number
}

/** Union type for WCL events */
type LegacyFriendlinessFlags = {
  sourceIsFriendly?: boolean
  targetIsFriendly?: boolean
}

export type WCLEvent = (
  | DamageEvent
  | HealEvent
  | ApplyBuffEvent
  | RefreshBuffEvent
  | ApplyBuffStackEvent
  | RemoveBuffEvent
  | RemoveBuffStackEvent
  | ApplyDebuffEvent
  | RefreshDebuffEvent
  | ApplyDebuffStackEvent
  | RemoveDebuffEvent
  | RemoveDebuffStackEvent
  | EnergizeEvent
  | ResourceChangeEvent
  | CastEvent
  | BeginCastEvent
  | InterruptEvent
  | DeathEvent
  | ResurrectEvent
  | SummonEvent
  | CombatantInfoEvent
) &
  LegacyFriendlinessFlags
