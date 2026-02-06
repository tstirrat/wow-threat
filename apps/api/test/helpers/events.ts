/**
 * Event Factory Helpers for Tests
 *
 * Provides factory functions to create WCL events with sensible defaults.
 * Reduces boilerplate in test files.
 */
import type {
  ApplyBuffEvent,
  ApplyDebuffEvent,
  CombatantInfoAura,
  DamageEvent,
  EnergizeEvent,
  HealEvent,
  RemoveBuffEvent,
  RemoveDebuffEvent,
} from '@wcl-threat/wcl-types'

/**
 * Create a damage event with default values
 *
 * Defaults:
 * - timestamp: 1000
 * - sourceID: 1 (player)
 * - targetID: 99 (enemy)
 * - amount: 100
 * - Basic ability (id: 1)
 */
export function createDamageEvent(
  overrides: Partial<DamageEvent> = {},
): DamageEvent {
  return {
    timestamp: 1000,
    type: 'damage',
    sourceID: 1,
    sourceIsFriendly: true,
    targetID: 99,
    targetIsFriendly: false,
    abilityGameID: 1,
    amount: 100,
    absorbed: 0,
    blocked: 0,
    mitigated: 0,
    overkill: 0,
    hitType: 'hit',
    tick: false,
    multistrike: false,
    ...overrides,
  }
}

/**
 * Create a heal event with default values
 *
 * Defaults:
 * - timestamp: 1000
 * - sourceID: 2 (healer)
 * - targetID: 1 (player)
 * - amount: 1000
 * - overheal: 0
 * - Basic heal ability (id: 1)
 */
export function createHealEvent(overrides: Partial<HealEvent> = {}): HealEvent {
  return {
    timestamp: 1000,
    type: 'heal',
    sourceID: 2,
    sourceIsFriendly: true,
    targetID: 1,
    targetIsFriendly: true,
    abilityGameID: 1,
    amount: 1000,
    absorbed: 0,
    overheal: 0,
    tick: false,
    ...overrides,
  }
}

/**
 * Create an energize event with default values
 *
 * Defaults:
 * - timestamp: 1000
 * - sourceID: 1 (player)
 * - targetID: 1 (self)
 * - resourceChange: 20
 * - resourceChangeType: 'rage'
 * - waste: 0
 * - Basic ability (id: 1)
 */
export function createEnergizeEvent(
  overrides: Partial<EnergizeEvent> = {},
): EnergizeEvent {
  return {
    timestamp: 1000,
    type: 'energize',
    sourceID: 1,
    sourceIsFriendly: true,
    targetID: 1,
    targetIsFriendly: true,
    abilityGameID: 1,
    resourceChange: 20,
    resourceChangeType: 'rage',
    waste: 0,
    ...overrides,
  }
}

/**
 * Create an applybuff event with default values
 *
 * Defaults:
 * - timestamp: 1000
 * - sourceID: 1 (self-buff)
 * - targetID: 1 (self)
 * - Basic buff ability (id: 1)
 */
export function createApplyBuffEvent(
  overrides: Partial<ApplyBuffEvent> = {},
): ApplyBuffEvent {
  return {
    timestamp: 1000,
    type: 'applybuff',
    sourceID: 1,
    sourceIsFriendly: true,
    targetID: 1,
    targetIsFriendly: true,
    abilityGameID: 1,
    ...overrides,
  }
}

/**
 * Create a removebuff event with default values
 *
 * Defaults:
 * - timestamp: 2000 (later than apply)
 * - sourceID: 1
 * - targetID: 1
 * - Basic buff ability (id: 1)
 */
export function createRemoveBuffEvent(
  overrides: Partial<RemoveBuffEvent> = {},
): RemoveBuffEvent {
  return {
    timestamp: 2000,
    type: 'removebuff',
    sourceID: 1,
    sourceIsFriendly: true,
    targetID: 1,
    targetIsFriendly: true,
    abilityGameID: 1,
    ...overrides,
  }
}

/**
 * Create an applydebuff event with default values
 *
 * Defaults:
 * - timestamp: 1000
 * - sourceID: 1 (self-buff)
 * - targetID: 2 (self)
 * - Basic buff ability (id: 1)
 */
export function createApplyDebuffEvent(
  overrides: Partial<ApplyDebuffEvent> = {},
): ApplyDebuffEvent {
  return {
    timestamp: 1000,
    type: 'applydebuff',
    sourceID: 1,
    sourceIsFriendly: true,
    targetID: 2,
    targetIsFriendly: false,
    abilityGameID: 1,
    ...overrides,
  }
}

/**
 * Create a removedebuff event with default values
 *
 * Defaults:
 * - timestamp: 1000
 * - sourceID: 1 (self-buff)
 * - targetID: 2 (self)
 * - Basic buff ability (id: 1)
 */
export function createRemoveDebuffEvent(
  overrides: Partial<RemoveDebuffEvent> = {},
): RemoveDebuffEvent {
  return {
    timestamp: 1000,
    type: 'removedebuff',
    sourceID: 1,
    sourceIsFriendly: true,
    targetID: 2,
    targetIsFriendly: false,
    abilityGameID: 1,
    ...overrides,
  }
}

/**
 * Create a combatantinfo aura entry
 *
 * @param abilityId - The spell ID of the aura
 * @param name - The name of the aura
 * @param sourceId - The source actor ID (defaults to 1)
 */
export function createCombatantInfoAura(
  abilityId: number,
  name: string,
  sourceId: number = 1,
): CombatantInfoAura {
  return {
    source: sourceId,
    abilityGameID: abilityId,
    stacks: 1,
    icon: `spell_${name.toLowerCase().replace(/\s/g, '_')}.jpg`,
    name,
  }
}
