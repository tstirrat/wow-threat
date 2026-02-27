/**
 * Unit tests for threat-chart ECharts series click handling.
 */
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useThreatChartSeriesClickHandler } from './use-threat-chart-series-click-handler'

describe('useThreatChartSeriesClickHandler', () => {
  it('ignores click events when the zoom hook suppresses the next click', () => {
    const onSeriesClick = vi.fn()
    const consumeSuppressedSeriesClick = vi.fn(() => true)

    const { result } = renderHook(() =>
      useThreatChartSeriesClickHandler({
        actorIdByLabel: new Map([['Tank', 7]]),
        consumeSuppressedSeriesClick,
        onSeriesClick,
      }),
    )

    result.current({
      componentType: 'series',
      seriesType: 'line',
      data: { focusedActorId: 7 },
      seriesName: 'Tank',
    })

    expect(onSeriesClick).not.toHaveBeenCalled()
  })

  it('focuses actor from payload focusedActorId when present', () => {
    const onSeriesClick = vi.fn()

    const { result } = renderHook(() =>
      useThreatChartSeriesClickHandler({
        actorIdByLabel: new Map([['Tank', 7]]),
        consumeSuppressedSeriesClick: () => false,
        onSeriesClick,
      }),
    )

    result.current({
      componentType: 'series',
      seriesType: 'line',
      data: { focusedActorId: '12' },
      seriesName: 'Tank',
    })

    expect(onSeriesClick).toHaveBeenCalledWith(12)
  })

  it('falls back to series label lookup when payload actor id is unavailable', () => {
    const onSeriesClick = vi.fn()

    const { result } = renderHook(() =>
      useThreatChartSeriesClickHandler({
        actorIdByLabel: new Map([['Mage', 3]]),
        consumeSuppressedSeriesClick: () => false,
        onSeriesClick,
      }),
    )

    result.current({
      componentType: 'series',
      seriesType: 'line',
      data: {},
      seriesName: 'Mage',
    })

    expect(onSeriesClick).toHaveBeenCalledWith(3)
  })

  it('ignores events that are not line series clicks', () => {
    const onSeriesClick = vi.fn()

    const { result } = renderHook(() =>
      useThreatChartSeriesClickHandler({
        actorIdByLabel: new Map([['Tank', 7]]),
        consumeSuppressedSeriesClick: () => false,
        onSeriesClick,
      }),
    )

    result.current({
      componentType: 'xAxis',
      seriesType: 'line',
      seriesName: 'Tank',
    })
    result.current({
      componentType: 'series',
      seriesType: 'bar',
      seriesName: 'Tank',
    })

    expect(onSeriesClick).not.toHaveBeenCalled()
  })
})
