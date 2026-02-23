/**
 * Unit tests for chart event visibility rules.
 */
import { describe, expect, it } from 'vitest'

import {
  isEnergizeEventType,
  shouldRenderThreatPoint,
} from './threat-chart-event-visibility'

describe('threat-chart-event-visibility', () => {
  it('matches resourcechange and energize event types', () => {
    expect(isEnergizeEventType('resourcechange')).toBe(true)
    expect(isEnergizeEventType('energize')).toBe(true)
    expect(isEnergizeEventType('EnErGiZe')).toBe(true)
    expect(isEnergizeEventType('damage')).toBe(false)
  })

  it('hides energize/resourcechange points when toggle is disabled', () => {
    expect(
      shouldRenderThreatPoint({
        point: { eventType: 'resourcechange' },
        showEnergizeEvents: false,
      }),
    ).toBe(false)
    expect(
      shouldRenderThreatPoint({
        point: { eventType: 'energize' },
        showEnergizeEvents: false,
      }),
    ).toBe(false)
    expect(
      shouldRenderThreatPoint({
        point: { eventType: 'damage' },
        showEnergizeEvents: false,
      }),
    ).toBe(true)
  })

  it('shows all point types when toggle is enabled', () => {
    expect(
      shouldRenderThreatPoint({
        point: { eventType: 'resourcechange' },
        showEnergizeEvents: true,
      }),
    ).toBe(true)
    expect(
      shouldRenderThreatPoint({
        point: { eventType: 'energize' },
        showEnergizeEvents: true,
      }),
    ).toBe(true)
  })
})
