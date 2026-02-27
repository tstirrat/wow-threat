/**
 * Resolve and clamp the selected threat chart window.
 */
import { useMemo } from 'react'

export interface ThreatChartWindowBounds {
  min: number
  max: number
}

export interface ThreatChartSelectedWindow {
  start: number
  end: number
}

/** Clamp chart window query values against active chart bounds. */
export function useThreatChartSelectedWindow({
  bounds,
  windowStartMs,
  windowEndMs,
}: {
  bounds: ThreatChartWindowBounds
  windowStartMs: number | null
  windowEndMs: number | null
}): ThreatChartSelectedWindow | null {
  return useMemo(() => {
    if (windowStartMs === null || windowEndMs === null) {
      return null
    }

    const start = Math.max(bounds.min, Math.min(windowStartMs, bounds.max))
    const end = Math.max(bounds.min, Math.min(windowEndMs, bounds.max))
    if (end - start < 1) {
      return null
    }

    return {
      start,
      end,
    }
  }, [bounds.max, bounds.min, windowEndMs, windowStartMs])
}
