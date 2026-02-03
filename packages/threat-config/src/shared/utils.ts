/**
 * Cross-version utility functions for threat calculations
 */

import type { ThreatContext, ThreatModifier, ThreatConfig } from '../types'

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
 * Finds which exclusive aura (if any) is active from a set of mutually exclusive auras
 */
export function getActiveExclusiveAura(
  ctx: ThreatContext,
  exclusiveAuras: Set<number>[]
): number | null {
  for (const auraSet of exclusiveAuras) {
    for (const auraId of auraSet) {
      if (ctx.sourceAuras.has(auraId)) {
        return auraId
      }
    }
  }
  return null
}

/**
 * Validates that there are no duplicate spell IDs across global and class aura modifiers.
 * Logs warnings in development for any duplicates found.
 */
export function validateAuraModifiers(config: ThreatConfig): void {
  const spellIdSources = new Map<number, string[]>()
  
  // Track global aura modifiers
  for (const spellIdStr of Object.keys(config.auraModifiers)) {
    const spellId = parseInt(spellIdStr, 10)
    if (!spellIdSources.has(spellId)) {
      spellIdSources.set(spellId, [])
    }
    spellIdSources.get(spellId)!.push('global')
  }
  
  // Track class aura modifiers
  for (const [className, classConfig] of Object.entries(config.classes)) {
    if (!classConfig?.auraModifiers) continue
    
    for (const spellIdStr of Object.keys(classConfig.auraModifiers)) {
      const spellId = parseInt(spellIdStr, 10)
      if (!spellIdSources.has(spellId)) {
        spellIdSources.set(spellId, [])
      }
      spellIdSources.get(spellId)!.push(className)
    }
  }
  
  // Report duplicates
  const duplicates: Array<{ spellId: number; sources: string[] }> = []
  for (const [spellId, sources] of spellIdSources) {
    if (sources.length > 1) {
      duplicates.push({ spellId, sources })
    }
  }
  
  if (duplicates.length > 0) {
    console.warn(
      '[ThreatConfig] Warning: Duplicate spell IDs found in aura modifiers. ' +
      'Later configs will override earlier ones when merged:'
    )
    for (const { spellId, sources } of duplicates) {
      console.warn(`  Spell ID ${spellId}: ${sources.join(', ')}`)
    }
  }
}
