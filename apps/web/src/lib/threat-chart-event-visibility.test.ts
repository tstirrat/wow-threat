/**
 * Unit tests for chart event visibility rules.
 */
import { describe, expect, it } from 'vitest'

import {
  isBossMeleeMarker,
  isEnergizeEventType,
  sortThreatPointsForRendering,
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
        point: { eventType: 'resourcechange', markerKind: undefined },
        showEnergizeEvents: false,
        showBossMelee: true,
      }),
    ).toBe(false)
    expect(
      shouldRenderThreatPoint({
        point: { eventType: 'energize', markerKind: undefined },
        showEnergizeEvents: false,
        showBossMelee: true,
      }),
    ).toBe(false)
    expect(
      shouldRenderThreatPoint({
        point: { eventType: 'damage', markerKind: undefined },
        showEnergizeEvents: false,
        showBossMelee: true,
      }),
    ).toBe(true)
  })

  it('shows all point types when toggle is enabled', () => {
    expect(
      shouldRenderThreatPoint({
        point: { eventType: 'resourcechange', markerKind: undefined },
        showEnergizeEvents: true,
        showBossMelee: true,
      }),
    ).toBe(true)
    expect(
      shouldRenderThreatPoint({
        point: { eventType: 'energize', markerKind: undefined },
        showEnergizeEvents: true,
        showBossMelee: true,
      }),
    ).toBe(true)
  })

  it('matches boss-melee marker kind', () => {
    expect(isBossMeleeMarker({ markerKind: 'bossMelee' })).toBe(true)
    expect(isBossMeleeMarker({ markerKind: 'death' })).toBe(false)
    expect(isBossMeleeMarker({ markerKind: undefined })).toBe(false)
  })

  it('hides boss-melee markers when toggle is disabled', () => {
    expect(
      shouldRenderThreatPoint({
        point: { eventType: 'damage', markerKind: 'bossMelee' },
        showEnergizeEvents: true,
        showBossMelee: false,
      }),
    ).toBe(false)
    expect(
      shouldRenderThreatPoint({
        point: { eventType: 'damage', markerKind: 'death' },
        showEnergizeEvents: true,
        showBossMelee: false,
      }),
    ).toBe(true)
  })

  it('prioritizes boss-melee markers at identical timestamps', () => {
    expect(
      sortThreatPointsForRendering([
        {
          markerKind: 'bossMelee',
          timeMs: 1000,
        },
        {
          markerKind: undefined,
          timeMs: 1000,
        },
        {
          markerKind: 'death',
          timeMs: 900,
        },
      ]),
    ).toEqual([
      {
        markerKind: 'death',
        timeMs: 900,
      },
      {
        markerKind: undefined,
        timeMs: 1000,
      },
      {
        markerKind: 'bossMelee',
        timeMs: 1000,
      },
    ])
  })
})
