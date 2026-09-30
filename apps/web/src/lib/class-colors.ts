/**
 * Utilities for rendering class-colored player labels and chart series.
 */
import type { PlayerClass } from '@wow-threat/wcl-types'

import type { ReportActorSummary } from '../types/api'

/** Theme-aware class colors; values are CSS variables defined per theme in index.css. */
export const classColors: Record<PlayerClass, string> = {
  Warrior: 'var(--class-warrior)',
  Paladin: 'var(--class-paladin)',
  Hunter: 'var(--class-hunter)',
  Rogue: 'var(--class-rogue)',
  Priest: 'var(--foreground)',
  'Death Knight': 'var(--class-death-knight)',
  Shaman: 'var(--class-shaman)',
  Mage: 'var(--class-mage)',
  Warlock: 'var(--class-warlock)',
  Monk: 'var(--class-monk)',
  Druid: 'var(--class-druid)',
  'Demon Hunter': 'var(--class-demon-hunter)',
  Evoker: 'var(--class-evoker)',
}

const fallbackColor = '#94a3b8'

/**
 * Resolve a CSS variable color string to its computed value for canvas (ECharts) contexts.
 * Returns the input unchanged for non-variable color strings.
 */
export function resolveCssColor(color: string): string {
  if (!color.startsWith('var(')) {
    return color
  }

  const varName = color.slice(4, -1).trim()
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim() || color
  )
}

/** Resolve a class color from a class name, with fallback for unknown classes. */
export function getClassColor(
  playerClass: PlayerClass | null | undefined,
): string {
  if (!playerClass) {
    return fallbackColor
  }

  return classColors[playerClass] ?? fallbackColor
}

/** Resolve an actor display color (players by class, pets by owner class). */
export function getActorColor(
  actor: ReportActorSummary,
  actorsById: Map<number, ReportActorSummary>,
): string {
  if (actor.type === 'Player') {
    return getClassColor(actor.subType as PlayerClass | undefined)
  }

  if (actor.type === 'Pet' && actor.petOwner) {
    const owner = actorsById.get(actor.petOwner)
    if (owner?.type === 'Player') {
      return getClassColor(owner.subType as PlayerClass | undefined)
    }
  }

  return fallbackColor
}
