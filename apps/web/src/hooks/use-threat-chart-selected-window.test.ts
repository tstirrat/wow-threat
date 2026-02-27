/**
 * Unit tests for selected threat-chart window normalization.
 */
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useThreatChartSelectedWindow } from './use-threat-chart-selected-window'

const bounds = { min: 100, max: 1000 }

describe('useThreatChartSelectedWindow', () => {
  it('returns null when either window boundary is missing', () => {
    const withoutStart = renderHook(() =>
      useThreatChartSelectedWindow({
        bounds,
        windowStartMs: null,
        windowEndMs: 400,
      }),
    )
    const withoutEnd = renderHook(() =>
      useThreatChartSelectedWindow({
        bounds,
        windowStartMs: 250,
        windowEndMs: null,
      }),
    )

    expect(withoutStart.result.current).toBeNull()
    expect(withoutEnd.result.current).toBeNull()
  })

  it('clamps selected window boundaries to chart bounds', () => {
    const { result } = renderHook(() =>
      useThreatChartSelectedWindow({
        bounds,
        windowStartMs: 50,
        windowEndMs: 1300,
      }),
    )

    expect(result.current).toEqual({
      start: 100,
      end: 1000,
    })
  })

  it('returns null when the selected window collapses to less than 1ms', () => {
    const { result } = renderHook(() =>
      useThreatChartSelectedWindow({
        bounds,
        windowStartMs: 500,
        windowEndMs: 500,
      }),
    )

    expect(result.current).toBeNull()
  })
})
