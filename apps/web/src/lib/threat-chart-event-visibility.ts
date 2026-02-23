/**
 * Event-type visibility rules for chart point rendering.
 */
import type { ThreatPoint } from '../types/app'

/** Return true when an event type is a resource-change point that can be hidden. */
export function isEnergizeEventType(eventType: string): boolean {
  const normalized = eventType.toLowerCase()
  return normalized === 'resourcechange' || normalized === 'energize'
}

/** Resolve whether a threat point should be rendered in the chart. */
export function shouldRenderThreatPoint({
  point,
  showEnergizeEvents,
}: {
  point: Pick<ThreatPoint, 'eventType'>
  showEnergizeEvents: boolean
}): boolean {
  if (showEnergizeEvents) {
    return true
  }

  return !isEnergizeEventType(point.eventType)
}
