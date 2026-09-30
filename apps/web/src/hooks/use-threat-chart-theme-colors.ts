/**
 * Theme color synchronization for threat chart rendering.
 */
import { useEffect, useState } from 'react'

import { resolveCssColor } from '../lib/class-colors'

export interface ThreatChartThemeColors {
  border: string
  foreground: string
  muted: string
  panel: string
  /** Resolve a CSS-variable color for canvas; identity changes on theme change. */
  resolveColor: (color: string) => string
}

function resolveThemeColor(variableName: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim()
  return value || fallback
}

function readChartThemeColors(): ThreatChartThemeColors {
  return {
    border: resolveThemeColor('--border', '#d1d5db'),
    foreground: resolveThemeColor('--foreground', '#0f172a'),
    muted: resolveThemeColor('--muted-foreground', '#64748b'),
    panel: resolveThemeColor('--card', '#ffffff'),
    resolveColor: (color) => resolveCssColor(color),
  }
}

/** Keep chart theme colors in sync with runtime theme changes. */
export function useThreatChartThemeColors(): ThreatChartThemeColors {
  const [themeColors, setThemeColors] = useState<ThreatChartThemeColors>(() =>
    readChartThemeColors(),
  )

  useEffect(() => {
    const updateThemeColors = (): void => {
      setThemeColors(readChartThemeColors())
    }

    window.addEventListener('themechange', updateThemeColors)
    return () => {
      window.removeEventListener('themechange', updateThemeColors)
    }
  }, [])

  return themeColors
}
