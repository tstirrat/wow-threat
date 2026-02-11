import type { ThreatContext, ThreatModifier } from '@wcl-threat/shared'

/**
 * Gets all active modifiers from a list of aura modifier configs
 */
export function getActiveModifiers(
  ctx: ThreatContext,
  auraModifiers: Record<number, (ctx: ThreatContext) => ThreatModifier>,
): ThreatModifier[] {
  const modifiers: ThreatModifier[] = []

  for (const [spellIdStr, modifierFn] of Object.entries(auraModifiers)) {
    const spellId = parseInt(spellIdStr, 10)
    if (ctx.sourceAuras.has(spellId)) {
      const modifier = modifierFn(ctx)

      // If modifier relies on specific spell IDs, check if current event matches
      if (modifier.spellIds) {
        const eventAbilityId =
          'abilityGameID' in ctx.event ? ctx.event.abilityGameID : undefined
        if (!eventAbilityId || !modifier.spellIds.has(eventAbilityId)) {
          continue
        }
      }

      // If modifier is school-scoped, only apply when the current event school matches.
      if (modifier.schools) {
        const hasMatchingSchool = [...modifier.schools].some(
          (school) => (ctx.spellSchoolMask & school) !== 0,
        )
        if (!hasMatchingSchool) {
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
