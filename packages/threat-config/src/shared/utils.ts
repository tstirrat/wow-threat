/**
 * Cross-version utility functions for threat calculations
 */
import type { ThreatConfig } from '@wcl-threat/shared'

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
        'Later configs will override earlier ones when merged:',
    )
    for (const { spellId, sources } of duplicates) {
      console.warn(`  Spell ID ${spellId}: ${sources.join(', ')}`)
    }
  }
}

/**
 * Validates that there are no duplicate spell IDs across global and class abilities.
 * Logs warnings in development for any duplicates found.
 */
export function validateAbilities(config: ThreatConfig): void {
  const spellIdSources = new Map<number, string[]>()

  // Track global abilities
  if (config.abilities) {
    for (const spellIdStr of Object.keys(config.abilities)) {
      const spellId = parseInt(spellIdStr, 10)
      if (!spellIdSources.has(spellId)) {
        spellIdSources.set(spellId, [])
      }
      spellIdSources.get(spellId)!.push('global')
    }
  }

  // Track class abilities
  for (const [className, classConfig] of Object.entries(config.classes)) {
    if (!classConfig?.abilities) continue

    for (const spellIdStr of Object.keys(classConfig.abilities)) {
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
      '[ThreatConfig] Warning: Duplicate spell IDs found in abilities. ' +
        'Later configs will override earlier ones when merged:',
    )
    for (const { spellId, sources } of duplicates) {
      console.warn(`  Spell ID ${spellId}: ${sources.join(', ')}`)
    }
  }
}
