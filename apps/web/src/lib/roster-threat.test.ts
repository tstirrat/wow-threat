/**
 * Tests for roster threat row building.
 */
import { describe, expect, it } from 'vitest'

import type { ThreatSeries } from '../types/app'
import {
  buildRosterThreatRows,
  resolveRosterPresetIds,
  resolveRosterShowPreset,
  resolveSeriesEndMs,
} from './roster-threat'

function createSeries(
  actorId: number,
  points: Array<[number, number]>,
): ThreatSeries {
  return {
    actorId,
    actorName: `P${actorId}`,
    actorClass: null,
    actorType: 'Player',
    ownerId: null,
    label: `P${actorId}`,
    color: '#fff',
    points: points.map(([timeMs, totalThreat]) => ({
      timeMs,
      totalThreat,
    })) as ThreatSeries['points'],
    maxThreat: 0,
    totalThreat: 0,
    totalDamage: 0,
    totalHealing: 0,
    stateVisualSegments: [],
    fixateWindows: [],
    invulnerabilityWindows: [],
  }
}

describe('roster-threat', () => {
  const series = [
    createSeries(1, [
      [0, 0],
      [10_000, 1000],
    ]),
    createSeries(2, [
      [0, 0],
      [5_000, 500],
      [10_000, 3000],
    ]),
  ]

  it('uses the end of the fight when there is no playhead', () => {
    const rows = buildRosterThreatRows(series, null)

    expect(resolveSeriesEndMs(series)).toBe(10_000)
    expect(rows.map((row) => row.series.actorId)).toEqual([2, 1])
    expect(rows[0]?.threat).toBe(3000)
  })

  it('computes rolling tps over the window before the time', () => {
    const rows = buildRosterThreatRows(series, 10_000)

    // P2: (3000 - 500) / 5s
    expect(rows[0]?.tps).toBe(500)
    // P1: (1000 - 0) / 5s
    expect(rows[1]?.tps).toBe(200)
  })

  it('re-sorts at an earlier playhead', () => {
    const rows = buildRosterThreatRows(series, 5_000)

    expect(rows.map((row) => row.series.actorId)).toEqual([2, 1])
    expect(rows[0]?.threat).toBe(500)
    expect(rows[1]?.threat).toBe(0)
  })

  it('resolves show presets and the active preset', () => {
    const tank = { ...createSeries(1, [[0, 10]]), actorRole: 'Tank' as const }
    const rows = buildRosterThreatRows(
      [tank, createSeries(2, [[0, 50]]), createSeries(3, [[0, 20]])],
      null,
    )
    const presets = resolveRosterPresetIds(rows)

    expect(presets.all).toEqual([2, 3, 1])
    expect(presets.tanks).toEqual([1])
    expect(presets.top).toEqual([2, 3, 1])
    expect(resolveRosterShowPreset(rows, () => true)).toBe('all')
    expect(resolveRosterShowPreset(rows, (id) => id === 1)).toBe('tanks')
    expect(resolveRosterShowPreset(rows, (id) => id === 2)).toBe('custom')
    expect(resolveRosterShowPreset(rows, () => false)).toBe('custom')
  })
})
