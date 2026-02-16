/**
 * Pointer interaction state for nearest-point and pinned tooltip behavior.
 */
import type ReactEChartsCore from 'echarts-for-react/lib/core'
import type { MutableRefObject } from 'react'
import { useEffect, useRef, useState } from 'react'

import type { ThreatPointMarkerKind, ThreatPointModifier } from '../types/app'

const tooltipSnapDistancePx = 10

export interface TooltipPointPayload {
  actorId: number
  actorColor: string
  abilityName: string
  amount: number
  baseThreat: number
  eventType: string
  formula: string
  modifiedThreat: number
  spellSchool: string | null
  modifiers: ThreatPointModifier[]
  threatDelta: number
  timeMs: number
  totalThreat: number
  markerKind?: ThreatPointMarkerKind
}

export interface SeriesChartPoint extends TooltipPointPayload {
  focusedActorId: number
  value: [number, number]
}

export interface ThreatChartSeriesEntry {
  actorId: number
  actorType: 'Player' | 'Pet'
  color: string
  data: SeriesChartPoint[]
  name: string
}

export interface PinnedTooltipState {
  actorId: number
  dataIndex: number
}

/** Manage pinned-tooltip and nearest-point hover behavior for the threat chart canvas. */
export function useThreatChartPinnedTooltip({
  chartRef,
  chartSeries,
}: {
  chartRef: MutableRefObject<ReactEChartsCore | null>
  chartSeries: ThreatChartSeriesEntry[]
}): PinnedTooltipState | null {
  const lastShownTooltipRef = useRef<{
    dataIndex: number
    seriesIndex: number
  } | null>(null)
  const pinnedTooltipRef = useRef<PinnedTooltipState | null>(null)
  const [pinnedTooltip, setPinnedTooltip] = useState<PinnedTooltipState | null>(
    null,
  )

  useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance()
    if (!chart) {
      return
    }

    const zr = chart.getZr()

    const hideTooltip = (): void => {
      if (!lastShownTooltipRef.current) {
        return
      }

      chart.dispatchAction({ type: 'hideTip' })
      lastShownTooltipRef.current = null
    }

    const resolvePointerPosition = (event: {
      offsetX?: number
      offsetY?: number
      zrX?: number
      zrY?: number
    }): { x: number; y: number } | null => {
      const x = event.offsetX ?? event.zrX
      const y = event.offsetY ?? event.zrY
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null
      }

      return { x, y }
    }

    const findNearestPoint = (event: {
      offsetX?: number
      offsetY?: number
      zrX?: number
      zrY?: number
    }): {
      actorId: number
      dataIndex: number
      distance: number
      seriesIndex: number
    } | null => {
      const pointer = resolvePointerPosition(event)
      if (!pointer) {
        return null
      }

      return chartSeries.reduce<{
        actorId: number
        dataIndex: number
        distance: number
        seriesIndex: number
      } | null>((closest, seriesEntry, seriesIndex) => {
        return seriesEntry.data.reduce<{
          actorId: number
          dataIndex: number
          distance: number
          seriesIndex: number
        } | null>((seriesClosest, point, dataIndex) => {
          const pixelPoint = chart.convertToPixel(
            { seriesIndex },
            point.value,
          ) as number[] | number
          if (!Array.isArray(pixelPoint) || pixelPoint.length !== 2) {
            return seriesClosest
          }

          const [pointX, pointY] = pixelPoint
          const distance = Math.hypot(pointX - pointer.x, pointY - pointer.y)
          if (distance > tooltipSnapDistancePx) {
            return seriesClosest
          }

          if (!seriesClosest || distance < seriesClosest.distance) {
            return {
              actorId: seriesEntry.actorId,
              dataIndex,
              distance,
              seriesIndex,
            }
          }

          return seriesClosest
        }, closest)
      }, null)
    }

    const showNearestTip = (
      nearest: { seriesIndex: number; dataIndex: number },
      force = false,
    ): void => {
      const previous = lastShownTooltipRef.current
      if (
        !force &&
        previous?.seriesIndex === nearest.seriesIndex &&
        previous.dataIndex === nearest.dataIndex
      ) {
        return
      }

      chart.dispatchAction({
        type: 'showTip',
        seriesIndex: nearest.seriesIndex,
        dataIndex: nearest.dataIndex,
      })
      lastShownTooltipRef.current = {
        seriesIndex: nearest.seriesIndex,
        dataIndex: nearest.dataIndex,
      }
    }

    const handleMouseMove = (event: {
      offsetX?: number
      offsetY?: number
      zrX?: number
      zrY?: number
    }): void => {
      const pinned = pinnedTooltipRef.current
      if (pinned) {
        const pinnedSeriesIndex = chartSeries.findIndex(
          (seriesEntry) => seriesEntry.actorId === pinned.actorId,
        )
        const hasPinnedPoint =
          pinnedSeriesIndex >= 0 &&
          chartSeries[pinnedSeriesIndex]?.data[pinned.dataIndex] !== undefined
        if (!hasPinnedPoint) {
          pinnedTooltipRef.current = null
          setPinnedTooltip(null)
          hideTooltip()
          return
        }

        showNearestTip(
          {
            seriesIndex: pinnedSeriesIndex,
            dataIndex: pinned.dataIndex,
          },
          true,
        )
        return
      }

      const nearest = findNearestPoint(event)

      if (!nearest) {
        hideTooltip()
        return
      }

      showNearestTip(nearest)
    }

    const handleClick = (event: {
      offsetX?: number
      offsetY?: number
      zrX?: number
      zrY?: number
    }): void => {
      const nearest = findNearestPoint(event)
      if (!nearest) {
        pinnedTooltipRef.current = null
        setPinnedTooltip(null)
        hideTooltip()
        return
      }

      const pinnedPoint = {
        actorId: nearest.actorId,
        dataIndex: nearest.dataIndex,
      }
      pinnedTooltipRef.current = pinnedPoint
      setPinnedTooltip(pinnedPoint)
      showNearestTip(nearest, true)
    }

    const handleGlobalOut = (): void => {
      const pinned = pinnedTooltipRef.current
      if (pinned) {
        const pinnedSeriesIndex = chartSeries.findIndex(
          (seriesEntry) => seriesEntry.actorId === pinned.actorId,
        )
        if (pinnedSeriesIndex >= 0) {
          showNearestTip(
            {
              seriesIndex: pinnedSeriesIndex,
              dataIndex: pinned.dataIndex,
            },
            true,
          )
          return
        }

        pinnedTooltipRef.current = null
        setPinnedTooltip(null)
        return
      }

      hideTooltip()
    }

    zr.on('mousemove', handleMouseMove)
    zr.on('click', handleClick)
    zr.on('globalout', handleGlobalOut)

    return () => {
      zr.off('mousemove', handleMouseMove)
      zr.off('click', handleClick)
      zr.off('globalout', handleGlobalOut)
    }
  }, [chartRef, chartSeries])

  return pinnedTooltip
}
