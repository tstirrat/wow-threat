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

  // Add class-specific aura modifiers
  const classConfig = getClassConfig(options.sourceActor.class, config)
  if (classConfig) {
    const auraModifiers = getActiveModifiers(ctx, classConfig.auraModifiers)
    allModifiers.push(...auraModifiers)
  }

  // Calculate total multiplier
  const totalMultiplier = getTotalMultiplier(allModifiers)
  const modifiedThreat = formulaResult.baseThreat * totalMultiplier

  // Split among enemies if needed
  const numEnemies = formulaResult.splitAmongEnemies ? options.enemies.length : 1
  const threatPerEnemy = numEnemies > 0 ? modifiedThreat / numEnemies : 0

  // Build threat values
  const values = buildThreatValues(
    options.enemies,
    threatPerEnemy,
    formulaResult.splitAmongEnemies,
    event
  )

  return {
    values,
    calculation: {
      formula: formulaResult.formula,
      baseValue: amount,
      baseThreat: formulaResult.baseThreat,
      threatToEnemy: threatPerEnemy,
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

/**
 * Track active auras throughout a fight
 */
export class AuraTracker {
  private activeAuras = new Map<number, Set<number>>() // actorId -> Set<spellId>

  /**
   * Process an aura event and update tracking
   */
  processEvent(event: WCLEvent): void {
    if (event.type === 'applybuff' || event.type === 'applydebuff') {
      this.addAura(event.targetID, event.ability.guid)
    } else if (event.type === 'removebuff' || event.type === 'removedebuff') {
      this.removeAura(event.targetID, event.ability.guid)
    }
  }

  /**
   * Get active auras for an actor
   */
  getAuras(actorId: number): Set<number> {
    return this.activeAuras.get(actorId) ?? new Set()
  }

  private addAura(actorId: number, spellId: number): void {
    if (!this.activeAuras.has(actorId)) {
      this.activeAuras.set(actorId, new Set())
    }
    this.activeAuras.get(actorId)!.add(spellId)
  }

  private removeAura(actorId: number, spellId: number): void {
    this.activeAuras.get(actorId)?.delete(spellId)
  }
}
