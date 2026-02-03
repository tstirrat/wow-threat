/**
 * Threat Calculation Service
 *
 * Orchestrates threat calculations by applying configs to WCL events.
 */

import type { WCLEvent } from '@wcl-threat/wcl-types'
import {
  type ThreatConfig,
  type ThreatContext,
  type ThreatResult,
  type ThreatModifier,
  type ClassThreatConfig,
  type WowClass,
  type Actor,
  type Enemy,
  getActiveModifiers,
  getTotalMultiplier,
} from '@wcl-threat/threat-config'

export interface CalculateThreatOptions {
  sourceAuras: Set<number>
  targetAuras: Set<number>
  enemies: Enemy[]
  sourceActor: Actor
  targetActor: Actor
  encounterId: number | null
}

/**
 * Calculate threat for a single event
 */
export function calculateThreat(
  event: WCLEvent,
  options: CalculateThreatOptions,
  config: ThreatConfig
): ThreatResult {
  const amount = getEventAmount(event)

  const ctx: ThreatContext = {
    event,
    amount,
    sourceAuras: options.sourceAuras,
    targetAuras: options.targetAuras,
    enemies: options.enemies,
    sourceActor: options.sourceActor,
    targetActor: options.targetActor,
    encounterId: options.encounterId,
  }

  // Get the threat formula result
  const formulaResult = getFormulaResult(ctx, config)

  // Collect all modifiers (class auras, etc.)
  const allModifiers = [...formulaResult.modifiers]

  // Add class-specific base threat factor
  const classConfig = getClassConfig(options.sourceActor.class, config)
  if (classConfig?.baseThreatFactor && classConfig.baseThreatFactor !== 1) {
    const className = options.sourceActor.class
      ? options.sourceActor.class.charAt(0).toUpperCase() + options.sourceActor.class.slice(1)
      : 'Class'
    
    allModifiers.push({
      source: 'class',
      name: className,
      value: classConfig.baseThreatFactor,
    })
  }

  // Merge all aura modifiers (global + all classes) into a single structure.
  // This allows cross-class buffs (e.g., Blessing of Salvation) to apply to any actor.
  // The game validates which buffs can be applied, so we merge everything and let
  // the sourceAuras set determine which modifiers actually apply.
  const mergedAuraModifiers: Record<number, (ctx: ThreatContext) => ThreatModifier> = {
    ...config.auraModifiers,
  }

  // Add aura modifiers from all class configs
  for (const classConfig of Object.values(config.classes)) {
    if (classConfig?.auraModifiers) {
      Object.assign(mergedAuraModifiers, classConfig.auraModifiers)
    }
  }

  // Apply the merged aura modifiers based on active auras
  const auraModifiers = getActiveModifiers(ctx, mergedAuraModifiers)
  allModifiers.push(...auraModifiers)

  // Calculate total multiplier
  const totalMultiplier = getTotalMultiplier(allModifiers)
  const modifiedThreat = formulaResult.baseThreat * totalMultiplier

  // Split among enemies if needed
  const numEnemies = formulaResult.splitAmongEnemies ? options.enemies.length : 1
  const threatPerEnemy = numEnemies > 0 ? modifiedThreat / numEnemies : 0

  // Build threat values (returns empty array for friendly targets)
  const values = buildThreatValues(
    options.enemies,
    threatPerEnemy,
    formulaResult.splitAmongEnemies,
    event
  )

  // If targeting a friendly unit, threat to enemies is 0
  const threatToEnemy = values.length === 0 ? 0 : threatPerEnemy

  return {
    values,
    calculation: {
      formula: formulaResult.formula,
      baseValue: amount,
      baseThreat: formulaResult.baseThreat,
      threatToEnemy,
      modifiers: allModifiers,
    },
  }
}

/**
 * Get the relevant amount from an event (damage, heal, etc.)
 */
function getEventAmount(event: WCLEvent): number {
  switch (event.type) {
    case 'damage':
      return event.amount
    case 'heal':
      return event.amount
    case 'energize':
      return event.resourceChange
    default:
      return 0
  }
}

/**
 * Get the formula result for an event
 */
function getFormulaResult(ctx: ThreatContext, config: ThreatConfig) {
  const event = ctx.event

  // Check for ability-specific formula first
  if ('ability' in event && event.ability) {
    const classConfig = getClassConfig(ctx.sourceActor.class, config)
    const abilityFormula = classConfig?.abilities[event.ability.guid]
    if (abilityFormula) {
      return abilityFormula(ctx)
    }
  }

  // Fall back to base threat formulas by event type
  switch (event.type) {
    case 'damage':
      return config.baseThreat.damage(ctx)
    case 'heal':
      return config.baseThreat.heal(ctx)
    case 'energize':
      return config.baseThreat.energize(ctx)
    default:
      // Default: no threat
      return {
        formula: '0',
        baseThreat: 0,
        modifiers: [],
        splitAmongEnemies: false,
      }
  }
}

/**
 * Get class config for an actor
 */
function getClassConfig(
  wowClass: WowClass | null,
  config: ThreatConfig
): ClassThreatConfig | null {
  if (!wowClass) return null
  return config.classes[wowClass] ?? null
}

/**
 * Build threat values for all relevant enemies
 */
function buildThreatValues(
  enemies: Enemy[],
  threatPerEnemy: number,
  isSplit: boolean,
  event: WCLEvent
): ThreatResult['values'] {
  // Damage to friendly targets generates no threat to enemies
  // (healing and energizing friendly targets still generate threat)
  if (event.type === 'damage' && 'targetIsFriendly' in event && event.targetIsFriendly) {
    return []
  }

  // If targeting a specific enemy (damage event), only that enemy gets threat
  if (!isSplit && 'targetID' in event && !event.targetIsFriendly) {
    const targetEnemy = enemies.find((e) => e.id === event.targetID)
    if (targetEnemy) {
      return [
        {
          enemyId: targetEnemy.id,
          enemyInstance: 'targetInstance' in event ? (event.targetInstance ?? 0) : 0,
          amount: threatPerEnemy,
          isSplit: false,
        },
      ]
    }
  }

  // Split threat among all enemies
  return enemies.map((enemy) => ({
    enemyId: enemy.id,
    enemyInstance: enemy.instance,
    amount: threatPerEnemy,
    isSplit,
  }))
}


