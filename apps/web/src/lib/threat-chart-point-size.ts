/**
 * Point-size rules for threat chart dots and markers.
 */
import type { SeriesChartPoint } from './threat-chart-types'

/** Resolve symbol size for a single point on the threat chart. */
export function resolvePointSize(point: SeriesChartPoint | undefined): number {
  if (!point) {
    return 6
  }

  if (point.markerKind === 'bossMelee') {
    return 9
  }

  if (point.markerKind === 'death') {
    return 8
  }

  if (point.markerKind === 'tranquilAirTotem') {
    return 9
  }

  if (point.eventType === 'resourcechange' || point.eventType === 'energize') {
    return 4
  }

  return 6
}
