/**
 * Cross-version utility functions for threat calculations
 */

import type { ThreatContext, ThreatModifier } from '../types'

/**
 * Checks if a spell ID is active in the source actor's auras
 */
export function hasAura(ctx: ThreatContext, spellId: number): boolean {
  return ctx.sourceAuras.has(spellId)
}

/**
 * Checks if any of the given spell IDs are active in the source actor's auras
 */
export function hasAnyAura(ctx: ThreatContext, spellIds: number[]): boolean {
  return spellIds.some((id) => ctx.sourceAuras.has(id))
}

/**
 * Gets all active modifiers from a list of aura modifier configs
 */
export function getActiveModifiers(
  ctx: ThreatContext,
  auraModifiers: Record<number, (ctx: ThreatContext) => ThreatModifier>
): ThreatModifier[] {
  const modifiers: ThreatModifier[] = []

  for (const [spellIdStr, modifierFn] of Object.entries(auraModifiers)) {
    const spellId = parseInt(spellIdStr, 10)
    if (ctx.sourceAuras.has(spellId)) {
      const modifier = modifierFn(ctx)
      
      // If modifier relies on specific spell IDs, check if current event matches
      if (modifier.spellIds) {
        const eventAbilityId = 'ability' in ctx.event ? ctx.event.ability?.guid : undefined
        if (!eventAbilityId || !modifier.spellIds.has(eventAbilityId)) {
          continue
        }
      }

      modifiers.push(modifier)
    }
  }

  return modifiers
}

/**
 * Calculates the total multiplier from a list of modifiers
 */
export function getTotalMultiplier(modifiers: ThreatModifier[]): number {
  return modifiers.reduce((acc, mod) => acc * mod.value, 1)
}

/**
 * Finds which stance (if any) is active from a set of mutually exclusive stances
 */
export function getActiveStance(
  ctx: ThreatContext,
  stanceSets: number[][]
): number | null {
  for (const stanceSet of stanceSets) {
    for (const stanceId of stanceSet) {
      if (ctx.sourceAuras.has(stanceId)) {
        return stanceId
      }
    }
  }
  return null
}
