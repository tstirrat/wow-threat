/**
 * Built-in Threat Formulas
 *
 * These helper functions create threat formula functions that can be used
 * in class configurations.
 */
import type {
  SpellThreatModifier,
  ThreatContext,
  ThreatFormulaResult,
} from '@wow-threat/shared'
import {
  type EventType,
  type HitType,
  HitTypeCode,
} from '@wow-threat/wcl-types'

export type FormulaFn = (ctx: ThreatContext) => ThreatFormulaResult | undefined

export interface FormulaOptions {
  /** Split threat among all enemies */
  split?: boolean
  /** Event types that should trigger this formula */
  eventTypes?: EventType[]
  /** Whether to apply player multipliers (class/aura/talent). Defaults to true. */
  applyPlayerMultipliers?: boolean
}

export interface ThreatOptions {
  /** Multiplier applied to event amount (default: 1) */
  modifier?: number
  /** Flat bonus threat added after modifier (default: 0) */
  bonus?: number
  /** Split threat among all enemies (default: false) */
  split?: boolean
  /** Event types that should trigger this formula */
  eventTypes?: EventType[]
  /** Whether to apply player multipliers (class/aura/talent). Defaults to true. */
  applyPlayerMultipliers?: boolean
}

const buffAuraEventTypes: EventType[] = [
  'applybuff',
  'refreshbuff',
  'applybuffstack',
]
const debuffAuraEventTypes: EventType[] = [
  'applydebuff',
  'refreshdebuff',
  'applydebuffstack',
]
const tauntAuraEventTypes: EventType[] = [
  ...buffAuraEventTypes,
  ...debuffAuraEventTypes,
]
const castRollbackHitTypes = new Set<HitType>([
  HitTypeCode.Miss,
  HitTypeCode.Dodge,
  HitTypeCode.Parry,
  HitTypeCode.Immune,
  HitTypeCode.Resist,
])
const modifyThreatOnHitHitTypes = new Set<HitType>([
  HitTypeCode.Hit,
  HitTypeCode.Crit,
  HitTypeCode.Block,
  HitTypeCode.Glancing,
  HitTypeCode.Crushing,
  HitTypeCode.Immune,
  HitTypeCode.Resist,
])
const successfulDamageHitTypes = new Set<HitType>([
  HitTypeCode.Hit,
  HitTypeCode.Crit,
  HitTypeCode.Block,
  HitTypeCode.Glancing,
  HitTypeCode.Crushing,
])

export function isHit(hitType: HitType) {
  return modifyThreatOnHitHitTypes.has(hitType)
}

function isEventTypeAllowed(
  eventType: EventType,
  allowedEventTypes?: EventType[],
): boolean {
  if (!allowedEventTypes || allowedEventTypes.length === 0) {
    return true
  }
  return allowedEventTypes.includes(eventType)
}

function createSpellModifier({
  modifier,
  bonus,
}: {
  modifier?: number
  bonus?: number
}): SpellThreatModifier | undefined {
  const hasMultiplier =
    modifier !== undefined && Math.abs(modifier - 1) > 0.0005
  const hasBonus = bonus !== undefined && Math.abs(bonus) > 0.0005

  if (!hasMultiplier && !hasBonus) {
    return undefined
  }

  const spellModifier: SpellThreatModifier = {
    type: 'spell',
  }

  if (hasMultiplier && modifier !== undefined) {
    spellModifier.value = modifier
  }

  if (hasBonus && bonus !== undefined) {
    spellModifier.bonus = bonus
  }

  return spellModifier
}

/**
 * Consolidated threat formula: (amount × modifier) + bonus
 * Replaces flat(), modAmount(), modAmountFlat(), defaultFormula(), threatOnBuff()
 *
 * @example
 * calculateThreat() // amt (default damage)
 * calculateThreat({ modifier: 2 }) // amt * 2
 * calculateThreat({ modifier: 0, bonus: 301 }) // 301 (flat threat)
 * calculateThreat({ modifier: 2, bonus: 150 }) // (amt * 2) + 150
 * calculateThreat({ modifier: 0.5, split: true }) // amt * 0.5 (split among enemies)
 */
export function threat(options: ThreatOptions = {}): FormulaFn {
  const {
    modifier = 1,
    bonus = 0,
    split = false,
    eventTypes = ['damage', 'heal'], // no double dip on cast+damage
    applyPlayerMultipliers,
  } = options

  return (ctx) => {
    if (!isEventTypeAllowed(ctx.event.type, eventTypes)) {
      return undefined
    }

    const value = ctx.amount * modifier + bonus
    const spellModifier = createSpellModifier({
      modifier,
      bonus,
    })

    return {
      value,
      splitAmongEnemies: split,
      ...(spellModifier ? { spellModifier } : {}),
      applyPlayerMultipliers,
    }
  }
}

/**
 * Consolidated hit-gated threat formula.
 * Applies (amount × modifier) + bonus only on successful damage hits.
 */
export function threatOnSuccessfulHit(options: ThreatOptions = {}): FormulaFn {
  const baseFormula = threat({
    ...options,
    eventTypes: ['damage'],
  })

  return (ctx) => {
    if (ctx.event.type !== 'damage') {
      return undefined
    }

    if (
      ctx.event.hitType !== undefined &&
      !successfulDamageHitTypes.has(ctx.event.hitType)
    ) {
      return undefined
    }

    if (ctx.event.hitType === undefined && ctx.amount <= 0) {
      return undefined
    }

    return baseFormula(ctx)
  }
}

export interface TauntOptions {
  /** Multiplier applied to event amount (default: 0) */
  modifier?: number
  /** Flat bonus threat added after modifier (default: 0) */
  bonus?: number
  /** Event types that should trigger this formula */
  eventTypes?: EventType[]
}

export interface ModifyThreatOptions {
  /** Threat multiplier to apply */
  modifier: number
  /** Target scope for threat modification */
  target?: 'target' | 'all'
  /** Event types that should trigger this formula */
  eventTypes?: EventType[]
}

export interface ThreatOnCastRollbackOnMissOptions {
  /** Whether to apply player multipliers (class/aura/talent). Defaults to true. */
  applyPlayerMultipliers?: boolean
}

/**
 * Taunt: sets source threat to top threat + ((amount * modifier) + bonus)
 * on the event target enemy.
 * Example: Taunt ({ bonus: 1 }), Mocking Blow ({ modifier: 1 })
 */
export function tauntTarget(options: TauntOptions = {}): FormulaFn {
  const { modifier = 0, bonus = 0, eventTypes = tauntAuraEventTypes } = options

  return (ctx) => {
    if (!isEventTypeAllowed(ctx.event.type, eventTypes)) {
      return undefined
    }

    const bonusThreat = ctx.amount * modifier + bonus
    const sourceId = ctx.sourceActor.id
    const targetId = ctx.targetActor.id
    const targetInstance = ctx.event.targetInstance ?? 0
    const currentThreat = ctx.actors.getThreat(sourceId, {
      id: targetId,
      instanceId: targetInstance,
    })
    const topThreat =
      ctx.actors.getTopActorsByThreat(
        {
          id: targetId,
          instanceId: targetInstance,
        },
        1,
      )[0]?.threat ?? 0
    const nextThreat = Math.max(currentThreat, topThreat + bonusThreat)
    const spellModifier = createSpellModifier({
      modifier,
      bonus,
    })

    return {
      value: 0,
      splitAmongEnemies: false,
      ...(spellModifier ? { spellModifier } : {}),
      note: 'taunt(topThreat+bonusThreat)',
      effects: [
        {
          type: 'customThreat',
          changes: [
            {
              sourceId,
              targetId,
              targetInstance,
              operator: 'set',
              amount: nextThreat,
              total: nextThreat,
            },
          ],
        },
      ],
    }
  }
}

/**
 * Threat modification: multiplies target's current threat against source
 * Examples:
 *   modifyThreat({ modifier: 0 }) - Threat wipe on event target (Vanish, Feign Death)
 *   modifyThreat({ modifier: 0.5 }) - Halve threat on event target (Onyxia's Knockaway)
 *   modifyThreat({ modifier: 0, target: 'all' }) - Wipe all threat on source enemy (Noth Blink)
 */
export function modifyThreat(options: ModifyThreatOptions): FormulaFn {
  const { modifier, target = 'target', eventTypes } = options

  return (ctx) => {
    if (!isEventTypeAllowed(ctx.event.type, eventTypes)) {
      return undefined
    }

    return {
      value: 0,
      splitAmongEnemies: false,
      note:
        modifier === 0
          ? `threatWipe(${target})`
          : `modifyThreat(${modifier},${target})`,
      effects: [
        {
          type: 'modifyThreat',
          multiplier: modifier,
          target,
        },
      ],
    }
  }
}

/**
 * Threat modification gated to successful damage/immune/resist hit results.
 * Mirrors classic boss "knock away / wing buffet" style threat drops.
 */
export function modifyThreatOnHit(multiplier: number): FormulaFn {
  const handler = modifyThreat({
    modifier: multiplier,
    eventTypes: ['damage'],
  })

  return (ctx) => {
    if (ctx.event.type !== 'damage' || !isHit(ctx.event.hitType)) {
      return undefined
    }

    return handler(ctx)
  }
}

/**
 * No threat: spell generates zero threat
 */
export function noThreat(): FormulaFn {
  return () => undefined
}

/**
 * Flat threat on debuff application (e.g., Demoralizing Shout)
 * Note: For abilities that miss, this should be paired with
 * threatOnCastRollbackOnMiss
 */
export function threatOnDebuff(value: number): FormulaFn {
  const eventTypes = debuffAuraEventTypes

  return (ctx) => {
    if (!isEventTypeAllowed(ctx.event.type, eventTypes)) {
      return undefined
    }

    const spellModifier = createSpellModifier({ modifier: 0, bonus: value })

    return {
      value,
      splitAmongEnemies: false,
      ...(spellModifier ? { spellModifier } : {}),
    }
  }
}

/**
 * Threat on debuff apply/refresh and normal threat on damage ticks.
 * Used by aura spells that both apply a debuff and periodically deal damage.
 */
export function threatOnDebuffOrDamage(value: number): FormulaFn {
  return (ctx) => {
    if (
      ctx.event.type === 'applydebuff' ||
      ctx.event.type === 'refreshdebuff' ||
      ctx.event.type === 'applydebuffstack'
    ) {
      const spellModifier = createSpellModifier({ modifier: 0, bonus: value })

      return {
        value,
        splitAmongEnemies: false,
        ...(spellModifier ? { spellModifier } : {}),
      }
    }

    if (ctx.event.type === 'damage') {
      return {
        value: ctx.amount,
        splitAmongEnemies: false,
      }
    }

    return undefined
  }
}

/**
 * Flat threat on buff application (e.g., Battle Shout)
 * Usually split among enemies
 */
export function threatOnBuff(
  value: number,
  options?: FormulaOptions,
): FormulaFn {
  const eventTypes = options?.eventTypes ?? buffAuraEventTypes

  return (ctx) => {
    if (!isEventTypeAllowed(ctx.event.type, eventTypes)) {
      return undefined
    }

    const spellModifier = createSpellModifier({ modifier: 0, bonus: value })

    return {
      value,
      splitAmongEnemies: options?.split ?? true,
      ...(spellModifier ? { spellModifier } : {}),
      applyPlayerMultipliers: options?.applyPlayerMultipliers,
    }
  }
}

/**
 * Threat on buff apply/refresh and normal threat on damage ticks.
 * Used by aura spells that both apply a debuff and periodically deal damage.
 */
export function threatOnBuffOrDamage(value: number): FormulaFn {
  return (ctx) => {
    if (
      ctx.event.type === 'applybuff' ||
      ctx.event.type === 'refreshbuff' ||
      ctx.event.type === 'applybuffstack'
    ) {
      const spellModifier = createSpellModifier({ modifier: 0, bonus: value })

      return {
        value,
        splitAmongEnemies: true,
        ...(spellModifier ? { spellModifier } : {}),
      }
    }

    if (ctx.event.type === 'damage') {
      return {
        value: ctx.amount,
        splitAmongEnemies: false,
      }
    }

    return undefined
  }
}

/**
 * Threat on cast that can miss - threat is applied on cast,
 * then removed if the ability misses (damage event with hitType > 6)
 * Example: Sunder Armor
 */
export function threatOnCastRollbackOnMiss(
  value: number,
  options: ThreatOnCastRollbackOnMissOptions = {},
): FormulaFn {
  return (ctx) => {
    if (ctx.event.type === 'cast') {
      const spellModifier = createSpellModifier({ modifier: 0, bonus: value })

      return {
        value,
        splitAmongEnemies: false,
        ...(spellModifier ? { spellModifier } : {}),
        note: 'castThreat(rollbackOnMiss)',
        applyPlayerMultipliers: options.applyPlayerMultipliers,
      }
    }

    if (
      ctx.event.type === 'damage' &&
      castRollbackHitTypes.has(ctx.event.hitType)
    ) {
      const rollbackValue = -value
      const spellModifier = createSpellModifier({
        modifier: 0,
        bonus: rollbackValue,
      })

      return {
        value: rollbackValue,
        splitAmongEnemies: false,
        ...(spellModifier ? { spellModifier } : {}),
        note: 'castThreat(missRollback)',
        applyPlayerMultipliers: options.applyPlayerMultipliers,
      }
    }

    if (ctx.event.type !== 'damage') {
      return undefined
    }
    return undefined
  }
}
