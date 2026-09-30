/**
 * Theme-aware text colors for data labels rendered in the DOM (tooltips, tables).
 *
 * Values use CSS light-dark(), which follows the root `color-scheme`. Each light
 * variant is the dark-theme color darkened in OKLCH (same hue) to ~4.6:1 on white.
 * Canvas marks keep their raw colors; these are for text only.
 */
import type { ThreatStateVisualKind } from '../types/app'

/** Build a text color that switches with the document color scheme. */
export function themedTextColor(light: string, dark: string): string {
  return `light-dark(${light}, ${dark})`
}

export const healTextColor = themedTextColor('#05873B', '#22c55e')
export const bossMeleeTextColor = themedTextColor('#DD3035', '#ef4444')
export const tranquilAirTotemTextColor = themedTextColor('#2A71E3', '#3b82f6')

export const threatStateTextColorByKind: Record<ThreatStateVisualKind, string> =
  {
    fixate: themedTextColor('#A36806', '#ffa500'),
    invulnerable: themedTextColor('#018801', '#00ff00'),
    aggroLoss: themedTextColor('#797902', '#ffff00'),
  }
