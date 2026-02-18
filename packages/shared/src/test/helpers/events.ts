/**
 * Event Factory Helpers for Tests
 *
 * Provides factory functions to create WCL events with sensible defaults.
 * Reduces boilerplate in test files.
 */
import {
  type ApplyBuffEvent,
  type ApplyBuffStackEvent,
  type ApplyDebuffEvent,
  type ApplyDebuffStackEvent,
  type CastEvent,
  type CombatantInfoAura,
  type CombatantInfoEvent,
  type DamageEvent,
  type EnergizeEvent,
  type HealEvent,
  type RefreshBuffEvent,
  type RefreshDebuffEvent,
  type RemoveBuffEvent,
  type RemoveBuffStackEvent,
  type RemoveDebuffEvent,
  type RemoveDebuffStackEvent,
  type ResourceChangeEvent,
  ResourceTypeCode,
} from '@wcl-threat/wcl-types'

type LegacyFriendlyFlagOverrides = {
  sourceIsFriendly?: boolean
  targetIsFriendly?: boolean
}

type EventOverrides<TEvent> = Partial<TEvent> & LegacyFriendlyFlagOverrides

function sanitizeEventOverrides<TEvent>(
  overrides: EventOverrides<TEvent>,
): Partial<TEvent> {
  const sanitized = { ...overrides }
  delete sanitized.sourceIsFriendly
  delete sanitized.targetIsFriendly
  return sanitized as Partial<TEvent>
}

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
  overrides: EventOverrides<DamageEvent> = {},
): DamageEvent {
  return {
    timestamp: 1000,
    type: 'damage',
    sourceID: 1,
    targetID: 99,
    abilityGameID: 1,
    amount: 100,
    absorbed: 0,
    blocked: 0,
    mitigated: 0,
    overkill: 0,
    hitType: 'hit',
    tick: false,
    multistrike: false,
    ...sanitizeEventOverrides(overrides),
  }
}

/**
 * Create a cast event with default values
 *
 * Defaults:
 * - timestamp: 1000
 * - sourceID: 1 (player)
 * - targetID: 99 (enemy)
 * - Basic ability (id: 1)
 */
export function createCastEvent(
  overrides: EventOverrides<CastEvent> = {},
): CastEvent {
  return {
    timestamp: 1000,
    type: 'cast',
    sourceID: 1,
    targetID: 99,
    abilityGameID: 1,
    ...sanitizeEventOverrides(overrides),
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
export function createHealEvent(
  overrides: EventOverrides<HealEvent> = {},
): HealEvent {
  return {
    timestamp: 1000,
    type: 'heal',
    sourceID: 2,
    targetID: 1,
    abilityGameID: 1,
    amount: 1000,
    absorbed: 0,
    overheal: 0,
    tick: false,
    ...sanitizeEventOverrides(overrides),
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
 * - resourceChangeType: ResourceTypeCode.Rage
 * - waste: 0
 * - Basic ability (id: 1)
 */
export function createEnergizeEvent(
  overrides: EventOverrides<EnergizeEvent> = {},
): EnergizeEvent {
  return {
    timestamp: 1000,
    type: 'energize',
    sourceID: 1,
    targetID: 1,
    abilityGameID: 1,
    resourceChange: 20,
    resourceChangeType: ResourceTypeCode.Rage,
    waste: 0,
    ...sanitizeEventOverrides(overrides),
  }
}

/**
 * Create a resourcechange event with default values
 */
export function createResourceChangeEvent(
  overrides: EventOverrides<ResourceChangeEvent> = {},
): ResourceChangeEvent {
  return {
    timestamp: 1000,
    type: 'resourcechange',
    sourceID: 1,
    targetID: 1,
    abilityGameID: 1,
    resourceChange: 20,
    resourceChangeType: ResourceTypeCode.Rage,
    waste: 0,
    ...sanitizeEventOverrides(overrides),
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
  overrides: EventOverrides<ApplyBuffEvent> = {},
): ApplyBuffEvent {
  return {
    timestamp: 1000,
    type: 'applybuff',
    sourceID: 1,
    targetID: 1,
    abilityGameID: 1,
    ...sanitizeEventOverrides(overrides),
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
  overrides: EventOverrides<RemoveBuffEvent> = {},
): RemoveBuffEvent {
  return {
    timestamp: 2000,
    type: 'removebuff',
    sourceID: 1,
    targetID: 1,
    abilityGameID: 1,
    ...sanitizeEventOverrides(overrides),
  }
}

/**
 * Create a refreshbuff event with default values
 */
export function createRefreshBuffEvent(
  overrides: EventOverrides<RefreshBuffEvent> = {},
): RefreshBuffEvent {
  return {
    timestamp: 1500,
    type: 'refreshbuff',
    sourceID: 1,
    targetID: 1,
    abilityGameID: 1,
    ...sanitizeEventOverrides(overrides),
  }
}

/**
 * Create an applybuffstack event with default values
 */
export function createApplyBuffStackEvent(
  overrides: EventOverrides<ApplyBuffStackEvent> = {},
): ApplyBuffStackEvent {
  return {
    timestamp: 1500,
    type: 'applybuffstack',
    sourceID: 1,
    targetID: 1,
    abilityGameID: 1,
    stacks: 2,
    ...sanitizeEventOverrides(overrides),
  }
}

/**
 * Create a removebuffstack event with default values
 */
export function createRemoveBuffStackEvent(
  overrides: EventOverrides<RemoveBuffStackEvent> = {},
): RemoveBuffStackEvent {
  return {
    timestamp: 1500,
    type: 'removebuffstack',
    sourceID: 1,
    targetID: 1,
    abilityGameID: 1,
    stacks: 0,
    ...sanitizeEventOverrides(overrides),
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
  overrides: EventOverrides<ApplyDebuffEvent> = {},
): ApplyDebuffEvent {
  return {
    timestamp: 1000,
    type: 'applydebuff',
    sourceID: 1,
    targetID: 2,
    abilityGameID: 1,
    ...sanitizeEventOverrides(overrides),
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
  overrides: EventOverrides<RemoveDebuffEvent> = {},
): RemoveDebuffEvent {
  return {
    timestamp: 1000,
    type: 'removedebuff',
    sourceID: 1,
    targetID: 2,
    abilityGameID: 1,
    ...sanitizeEventOverrides(overrides),
  }
}

/**
 * Create a refreshdebuff event with default values
 */
export function createRefreshDebuffEvent(
  overrides: EventOverrides<RefreshDebuffEvent> = {},
): RefreshDebuffEvent {
  return {
    timestamp: 1500,
    type: 'refreshdebuff',
    sourceID: 1,
    targetID: 2,
    abilityGameID: 1,
    ...sanitizeEventOverrides(overrides),
  }
}

/**
 * Create an applydebuffstack event with default values
 */
export function createApplyDebuffStackEvent(
  overrides: EventOverrides<ApplyDebuffStackEvent> = {},
): ApplyDebuffStackEvent {
  return {
    timestamp: 1500,
    type: 'applydebuffstack',
    sourceID: 1,
    targetID: 2,
    abilityGameID: 1,
    stacks: 2,
    ...sanitizeEventOverrides(overrides),
  }
}

/**
 * Create a removedebuffstack event with default values
 */
export function createRemoveDebuffStackEvent(
  overrides: EventOverrides<RemoveDebuffStackEvent> = {},
): RemoveDebuffStackEvent {
  return {
    timestamp: 1500,
    type: 'removedebuffstack',
    sourceID: 1,
    targetID: 2,
    abilityGameID: 1,
    stacks: 0,
    ...sanitizeEventOverrides(overrides),
  }
}

/**
 * Create a combatantinfo event with default values
 */
export function createCombatantInfoEvent(
  overrides: EventOverrides<CombatantInfoEvent> = {},
): CombatantInfoEvent {
  return {
    timestamp: 1000,
    type: 'combatantinfo',
    sourceID: 1,
    targetID: 2,
    auras: [createCombatantInfoAura(71, 'Battle Stance')],
    talents: [
      { id: 0, icon: '' },
      { id: 0, icon: '' },
      { id: 0, icon: '' },
    ],
    ...sanitizeEventOverrides(overrides),
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
    ability: abilityId,
    stacks: 1,
    icon: `spell_${name.toLowerCase().replace(/\s/g, '_')}.jpg`,
    name,
  }
}
