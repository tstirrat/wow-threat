/**
 * Unit tests for threat-chart series render-data derivation hook.
 */
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { bossMeleeMarkerColor } from '../lib/threat-chart-tooltip'
import type { ThreatPoint, ThreatSeries } from '../types/app'
import { useThreatChartSeriesData } from './use-threat-chart-series-data'

function createPoint(
  overrides: Partial<ThreatPoint> &
    Pick<ThreatPoint, 'eventType' | 'timeMs' | 'totalThreat'>,
): ThreatPoint {
  return {
    timestamp: overrides.timeMs,
    timeMs: overrides.timeMs,
    totalThreat: overrides.totalThreat,
    threatDelta: 0,
    amount: 0,
    baseThreat: 0,
    modifiedThreat: 0,
    spellSchool: null,
    eventType: overrides.eventType,
    abilityName: 'Test Ability',
    formula: 'test',
    modifiers: [],
    ...overrides,
  }
}

function createSeries(
  overrides: Partial<ThreatSeries> &
    Pick<ThreatSeries, 'actorId' | 'actorType' | 'label'>,
): ThreatSeries {
  return {
    actorId: overrides.actorId,
    actorName: overrides.label,
    actorClass: null,
    actorType: overrides.actorType,
    ownerId: null,
    label: overrides.label,
    color: '#c79c6e',
    points: [],
    maxThreat: 0,
    totalThreat: 0,
    totalDamage: 0,
    totalHealing: 0,
    stateVisualSegments: [],
    fixateWindows: [],
    invulnerabilityWindows: [],
    ...overrides,
  }
}

describe('useThreatChartSeriesData', () => {
  it('builds chart series data, label lookups, and visual maps from visible series', () => {
    const tankSeries = createSeries({
      actorId: 1,
      actorType: 'Player',
      label: 'Tank',
      points: [
        createPoint({
          abilityName: 'Sunder Armor',
          eventType: 'damage',
          timeMs: 200,
          totalThreat: 120,
        }),
        createPoint({
          abilityName: 'Bloodrage',
          eventType: 'energize',
          timeMs: 150,
          totalThreat: 140,
        }),
        createPoint({
          abilityName: 'Boss Melee',
          eventType: 'damage',
          markerKind: 'bossMelee',
          timeMs: 200,
          totalThreat: 160,
        }),
      ],
      stateVisualSegments: [{ kind: 'fixate', startMs: 120, endMs: 260 }],
    })
    const mageSeries = createSeries({
      actorId: 2,
      actorType: 'Player',
      label: 'Mage',
    })

    const { result, rerender } = renderHook(
      (props: {
        series: ThreatSeries[]
        visibleSeries: ThreatSeries[]
        showEnergizeEvents: boolean
        bossDamageMode: 'off' | 'melee' | 'all'
      }) => useThreatChartSeriesData(props),
      {
        initialProps: {
          series: [tankSeries, mageSeries],
          visibleSeries: [tankSeries],
          showEnergizeEvents: false,
          bossDamageMode: 'off',
        },
      },
    )

    expect(result.current.actorIdByLabel.get('Tank')).toBe(1)
    expect(result.current.actorIdByLabel.get('Mage')).toBe(2)
    expect(result.current.chartSeries).toHaveLength(1)
    expect(result.current.chartSeries[0]?.data).toHaveLength(1)
    expect(result.current.chartSeries[0]?.data[0]?.abilityName).toBe(
      'Sunder Armor',
    )
    expect(result.current.threatStateVisualMaps).toHaveLength(1)

    rerender({
      series: [tankSeries, mageSeries],
      visibleSeries: [tankSeries],
      showEnergizeEvents: true,
      bossDamageMode: 'all',
    })

    const visiblePoints = result.current.chartSeries[0]?.data ?? []
    expect(visiblePoints).toHaveLength(3)
    expect(visiblePoints[2]?.markerKind).toBe('bossMelee')
    expect(visiblePoints[2]?.itemStyle.color).toBe(bossMeleeMarkerColor)
  })
})
