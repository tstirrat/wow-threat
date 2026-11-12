/**
 * Tests for snapping a clicked chart time to the nearest visible event.
 */
import { describe, expect, it } from 'vitest'

import type { ThreatPoint, ThreatSeries } from '../types/app'
import { resolveNearestEventTimeMs } from './use-threat-chart-playhead'

function createSeries(timesMs: number[]): ThreatSeries {
  return {
    points: timesMs.map((timeMs) => ({ timeMs }) as ThreatPoint),
  } as ThreatSeries
}

describe('resolveNearestEventTimeMs', () => {
  it('returns null when there are no events', () => {
    expect(resolveNearestEventTimeMs([], 1000)).toBeNull()
    expect(resolveNearestEventTimeMs([createSeries([])], 1000)).toBeNull()
  })

  it('snaps to the closest event across all series', () => {
    const series = [createSeries([0, 1000, 5000]), createSeries([2200, 9000])]

    expect(resolveNearestEventTimeMs(series, 1900)).toBe(2200)
    expect(resolveNearestEventTimeMs(series, 4000)).toBe(5000)
    expect(resolveNearestEventTimeMs(series, 20_000)).toBe(9000)
  })
})
