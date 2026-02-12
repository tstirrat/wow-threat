/**
 * Unit tests for threat chart state visual helpers.
 */
import { describe, expect, it } from 'vitest'

import {
  buildAuraMarkArea,
  buildFixateMarkArea,
  resolveThreatStateStatus,
  buildThreatStateVisualMaps,
  fixateMarkAreaColor,
  invulnerabilityMarkAreaColor,
} from './threat-chart-visuals'
import type { ThreatSeries } from '../types/app'

const baseSeries: ThreatSeries = {
  actorId: 1,
  actorName: 'Warrior',
  actorClass: 'Warrior',
  actorType: 'Player',
  ownerId: null,
  label: 'Warrior',
  color: '#c79c6e',
  points: [],
  maxThreat: 0,
  totalThreat: 0,
  totalDamage: 0,
  totalHealing: 0,
  stateVisualSegments: [],
  fixateWindows: [],
  invulnerabilityWindows: [],
}

describe('threat-chart-visuals', () => {
  it('builds hidden visualMap pieces and preserves base series color out of range', () => {
    const visualMaps = buildThreatStateVisualMaps([
      {
        ...baseSeries,
        stateVisualSegments: [
          { kind: 'fixate', startMs: 10, endMs: 20 },
          { kind: 'invulnerable', startMs: 20, endMs: 30 },
          { kind: 'aggroLoss', startMs: 30, endMs: 40 },
        ],
      },
    ])

    expect(visualMaps).toEqual([
      {
        type: 'piecewise',
        show: false,
        seriesIndex: 0,
        dimension: 0,
        pieces: [
          { gte: 10, lt: 20, color: '#ffa500' },
          { gte: 20, lt: 30, color: '#0f0' },
          { gte: 30, lt: 40, color: '#ff0' },
        ],
        outOfRange: {
          color: '#c79c6e',
        },
      },
    ])
  })

  it('builds fixate markArea with expected background color', () => {
    const markArea = buildFixateMarkArea([
      { startMs: 25, endMs: 75 },
      { startMs: 100, endMs: 140 },
    ])

    expect(markArea).toEqual({
      silent: true,
      itemStyle: {
        color: fixateMarkAreaColor,
      },
      data: [
        [{ xAxis: 25 }, { xAxis: 75 }],
        [{ xAxis: 100 }, { xAxis: 140 }],
      ],
    })
  })

  it('builds combined aura markArea including invulnerability', () => {
    const markArea = buildAuraMarkArea({
      fixateWindows: [{ startMs: 25, endMs: 75 }],
      invulnerabilityWindows: [{ startMs: 100, endMs: 140 }],
    })

    expect(markArea).toEqual({
      silent: true,
      data: [
        [
          { xAxis: 25, itemStyle: { color: fixateMarkAreaColor } },
          { xAxis: 75 },
        ],
        [
          {
            xAxis: 100,
            itemStyle: { color: invulnerabilityMarkAreaColor },
          },
          { xAxis: 140 },
        ],
      ],
    })
  })

  it('returns no visual overlays when there are no state windows', () => {
    expect(buildThreatStateVisualMaps([baseSeries])).toEqual([])
    expect(buildFixateMarkArea([])).toBeUndefined()
  })

  it('resolves tooltip status from active state segment at a time point', () => {
    const withStateSegments: ThreatSeries = {
      ...baseSeries,
      stateVisualSegments: [
        { kind: 'fixate', startMs: 10, endMs: 20 },
        { kind: 'invulnerable', startMs: 20, endMs: 40 },
      ],
    }

    expect(resolveThreatStateStatus(withStateSegments, 15)).toEqual({
      color: '#ffa500',
      label: 'fixate',
    })
    expect(resolveThreatStateStatus(withStateSegments, 25)).toEqual({
      color: '#0f0',
      label: 'invulnerability',
    })
    expect(resolveThreatStateStatus(withStateSegments, 50)).toEqual({
      color: null,
      label: 'Normal',
    })
  })
})
