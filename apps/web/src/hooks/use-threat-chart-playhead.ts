/**
 * Click-on-empty-space interaction that sets the chart playhead (T), snapped to the nearest visible event.
 */
import type ReactEChartsCore from 'echarts-for-react/esm/core'
import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'

import type { ThreatSeries } from '../types/app'

/** Pointer travel (px) above which a press counts as a drag-zoom, not a click. */
const CLICK_MAX_TRAVEL_PX = 8

interface PointerEventLike {
  offsetX?: number
  offsetY?: number
  zrX?: number
  zrY?: number
  event?: { detail?: number }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Find the event time closest to `timeMs` across the given series, or null when empty. */
export function resolveNearestEventTimeMs(
  series: ThreatSeries[],
  timeMs: number,
): number | null {
  return series
    .flatMap((item) => item.points)
    .reduce<number | null>((nearest, point) => {
      if (
        nearest === null ||
        Math.abs(point.timeMs - timeMs) < Math.abs(nearest - timeMs)
      ) {
        return point.timeMs
      }
      return nearest
    }, null)
}

/** Attach ZRender handlers so a click on empty chart space sets T (never on a point or line). */
export function useThreatChartPlayhead({
  chartRef,
  isChartReady,
  bounds,
  visibleSeries,
  onPlayheadChange,
}: {
  chartRef: RefObject<ReactEChartsCore | null>
  isChartReady: boolean
  bounds: { min: number; max: number }
  visibleSeries: ThreatSeries[]
  onPlayheadChange: (timeMs: number) => void
}): void {
  const visibleSeriesRef = useRef(visibleSeries)

  useEffect(() => {
    visibleSeriesRef.current = visibleSeries
  }, [visibleSeries])

  useEffect(() => {
    if (!isChartReady) {
      return
    }

    const chart = chartRef.current?.getEchartsInstance()
    if (!chart) {
      return
    }

    const zr = chart.getZr()
    let pressPoint: [number, number] | null = null
    let didHitSeries = false

    const resolvePointer = (
      event: PointerEventLike,
    ): [number, number] | null => {
      const x = event.offsetX ?? event.zrX
      const y = event.offsetY ?? event.zrY
      if (
        x === undefined ||
        y === undefined ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        return null
      }

      return [x, y]
    }

    // ECharts dispatches its own click first, so this flag is set before the zr click below.
    const handleSeriesClick = (): void => {
      didHitSeries = true
    }

    const handleMouseDown = (event: PointerEventLike): void => {
      pressPoint = resolvePointer(event)
    }

    const handleClick = (event: PointerEventLike): void => {
      const press = pressPoint
      pressPoint = null
      const hitSeries = didHitSeries
      didHitSeries = false

      const pointer = resolvePointer(event)
      if (!pointer || hitSeries || (event.event?.detail ?? 1) > 1) {
        return
      }
      if (!chart.containPixel({ gridIndex: 0 }, pointer)) {
        return
      }
      if (
        press &&
        Math.hypot(pointer[0] - press[0], pointer[1] - press[1]) >=
          CLICK_MAX_TRAVEL_PX
      ) {
        return
      }

      const value = Number(
        chart.convertFromPixel(
          { xAxisIndex: 0 },
          clamp(pointer[0], 0, chart.getWidth()),
        ),
      )
      if (!Number.isFinite(value)) {
        return
      }

      const snapped = resolveNearestEventTimeMs(visibleSeriesRef.current, value)
      onPlayheadChange(
        clamp(Math.round(snapped ?? value), bounds.min, bounds.max),
      )
    }

    chart.on('click', 'series', handleSeriesClick)
    zr.on('mousedown', handleMouseDown)
    zr.on('click', handleClick)

    return () => {
      chart.off('click', handleSeriesClick)
      zr.off('mousedown', handleMouseDown)
      zr.off('click', handleClick)
    }
  }, [bounds.max, bounds.min, chartRef, isChartReady, onPlayheadChange])
}
