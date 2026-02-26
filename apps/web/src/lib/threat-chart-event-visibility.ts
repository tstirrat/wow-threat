/**
 * Event-type visibility rules for chart point rendering.
 */
import type { ThreatPoint } from '../types/app'

/** Return true when an event type is a resource-change point that can be hidden. */
export function isEnergizeEventType(eventType: string): boolean {
  const normalized = eventType.toLowerCase()
  return normalized === 'resourcechange' || normalized === 'energize'
}

/** Return true when a point is a boss-melee marker. */
export function isBossMeleeMarker(
  point: Pick<ThreatPoint, 'markerKind'>,
): boolean {
  return point.markerKind === 'bossMelee'
}

/** Sort points to ensure boss-melee markers render above same-timestamp points. */
export function sortThreatPointsForRendering<T extends Pick<ThreatPoint, 'markerKind' | 'timeMs'>>(
  points: T[],
): T[] {
  return [...points].sort((left, right) => {
    const timeDiff = left.timeMs - right.timeMs
    if (timeDiff !== 0) {
      return timeDiff
    }

    const leftPriority = isBossMeleeMarker(left) ? 1 : 0
    const rightPriority = isBossMeleeMarker(right) ? 1 : 0
    return leftPriority - rightPriority
  })
}

/** Resolve whether a threat point should be rendered in the chart. */
export function shouldRenderThreatPoint({
  point,
  showEnergizeEvents,
  showBossMelee,
}: {
  point: Pick<ThreatPoint, 'eventType' | 'markerKind'>
  showEnergizeEvents: boolean
  showBossMelee: boolean
}): boolean {
  if (!showBossMelee && isBossMeleeMarker(point)) {
    return false
  }

  if (!showEnergizeEvents && isEnergizeEventType(point.eventType)) {
    return false
  }

  return true
}
