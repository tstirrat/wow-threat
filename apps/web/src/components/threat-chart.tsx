/**
 * ECharts threat timeline with deep-linkable zoom and legend isolation behavior.
 */
import type { EChartsOption } from 'echarts'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers'
import { type FC, useEffect, useMemo, useRef, useState } from 'react'

import { formatNumber, formatTimelineTime } from '../lib/format'
import {
  buildAuraMarkArea,
  buildThreatStateVisualMaps,
  resolveThreatStateStatus,
} from '../lib/threat-chart-visuals'
import { resolveSeriesWindowBounds } from '../lib/threat-aggregation'
import type { ThreatSeries } from '../types/app'

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkAreaComponent,
  MarkPointComponent,
  CanvasRenderer,
  SVGRenderer,
])

interface LegendClickState {
  name: string
  timestamp: number
}

interface ChartThemeColors {
  border: string
  foreground: string
  muted: string
  panel: string
}

interface TooltipPointPayload {
  actorId: number
  actorColor: string
  abilityName: string
  amount: number
  baseThreat: number
  eventType: string
  formula: string
  modifiedThreat: number
  modifiers: string
  threatDelta: number
  timeMs: number
  totalThreat: number
}

interface SeriesChartPoint extends TooltipPointPayload {
  playerId: number | null
  value: [number, number]
}

const doubleClickThresholdMs = 320
const tooltipSnapDistancePx = 10

function resetLegendSelection(
  chart: ReturnType<ReactEChartsCore['getEchartsInstance']>,
  names: string[],
): void {
  names.forEach((name) => {
    chart.dispatchAction({ type: 'legendSelect', name })
  })
}

function isolateLegendSelection(
  chart: ReturnType<ReactEChartsCore['getEchartsInstance']>,
  isolateName: string,
  names: string[],
): void {
  names.forEach((name) => {
    chart.dispatchAction({
      type: name === isolateName ? 'legendSelect' : 'legendUnSelect',
      name,
    })
  })
}

function resolveThemeColor(variableName: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim()
  return value || fallback
}

function readChartThemeColors(): ChartThemeColors {
  return {
    border: resolveThemeColor('--border', '#d1d5db'),
    foreground: resolveThemeColor('--foreground', '#0f172a'),
    muted: resolveThemeColor('--muted-foreground', '#64748b'),
    panel: resolveThemeColor('--card', '#ffffff'),
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatSignedThreat(value: number): string {
  const prefix = value >= 0 ? '+' : '-'
  return `${prefix}${formatNumber(Math.abs(value))}`
}

function formatTooltipModifiers(modifiers: string): string[] {
  const normalized = modifiers.trim()
  if (!normalized || normalized === 'none') {
    return []
  }

  return normalized
    .split(', ')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export type ThreatChartProps = {
  series: ThreatSeries[]
  renderer?: 'canvas' | 'svg'
  windowStartMs: number | null
  windowEndMs: number | null
  onWindowChange: (startMs: number | null, endMs: number | null) => void
  onSeriesClick: (playerId: number) => void
}

export const ThreatChart: FC<ThreatChartProps> = ({
  series,
  renderer = 'canvas',
  windowStartMs,
  windowEndMs,
  onWindowChange,
  onSeriesClick,
}) => {
  const chartRef = useRef<ReactEChartsCore>(null)
  const lastLegendClickRef = useRef<LegendClickState | null>(null)
  const lastShownTooltipRef = useRef<{
    dataIndex: number
    seriesIndex: number
  } | null>(null)
  const pinnedTooltipRef = useRef<{
    dataIndex: number
    seriesIndex: number
  } | null>(null)
  const [pinnedTooltip, setPinnedTooltip] = useState<{
    dataIndex: number
    seriesIndex: number
  } | null>(null)
  const [isolatedActorId, setIsolatedActorId] = useState<number | null>(null)
  const [themeColors, setThemeColors] = useState<ChartThemeColors>(() =>
    readChartThemeColors(),
  )

  const bounds = resolveSeriesWindowBounds(series)
  const visibleIsolatedActorId =
    isolatedActorId !== null &&
    series.some((item) => item.actorId === isolatedActorId)
      ? isolatedActorId
      : null

  const legendNames = series.map((item) => item.label)
  const actorIdByLabel = new Map(
    series.map((item) => [item.label, item.actorId]),
  )
  const playerIdByLabel = new Map(
    series.map((item) => [
      item.label,
      item.actorType === 'Player' ? item.actorId : item.ownerId,
    ]),
  )

  useEffect(() => {
    const updateThemeColors = (): void => {
      setThemeColors(readChartThemeColors())
    }

    window.addEventListener('themechange', updateThemeColors)
    return () => {
      window.removeEventListener('themechange', updateThemeColors)
    }
  }, [])

  const startValue = windowStartMs ?? bounds.min
  const endValue = windowEndMs ?? bounds.max
  const legendWidthPx = 128
  const legendRightOffsetPx = 8
  const threatStateVisualMaps = buildThreatStateVisualMaps(series)
  const chartSeries = useMemo(
    () =>
      series.map((item) => {
        const playerId =
          item.actorType === 'Player' ? item.actorId : item.ownerId
        const toDataPoint = (
          point: ThreatSeries['points'][number],
        ): SeriesChartPoint => ({
          ...point,
          actorId: item.actorId,
          actorColor: item.color,
          playerId,
          value: [point.timeMs, point.totalThreat],
        })

        return {
          actorType: item.actorType,
          color: item.color,
          data: item.points.map(toDataPoint),
          name: item.label,
        }
      }),
    [series],
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
      dataIndex: number
      distance: number
      seriesIndex: number
    } | null => {
      const pointer = resolvePointerPosition(event)
      if (!pointer) {
        return null
      }

      const legendOption = chart.getOption().legend?.[0] as
        | {
            selected?: Record<string, boolean>
          }
        | undefined
      const legendSelection = legendOption?.selected

      return chartSeries.reduce<{
        dataIndex: number
        distance: number
        seriesIndex: number
      } | null>((closest, seriesEntry, seriesIndex) => {
        if (legendSelection?.[seriesEntry.name] === false) {
          return closest
        }

        return seriesEntry.data.reduce<{
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
        const hasPinnedPoint =
          chartSeries[pinned.seriesIndex]?.data[pinned.dataIndex] !== undefined
        if (!hasPinnedPoint) {
          pinnedTooltipRef.current = null
          setPinnedTooltip(null)
          hideTooltip()
          return
        }

        showNearestTip(pinned, true)
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
        seriesIndex: nearest.seriesIndex,
        dataIndex: nearest.dataIndex,
      }
      pinnedTooltipRef.current = pinnedPoint
      setPinnedTooltip(pinnedPoint)
      showNearestTip(nearest, true)
    }

    const handleGlobalOut = (): void => {
      if (pinnedTooltipRef.current) {
        showNearestTip(pinnedTooltipRef.current, true)
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
  }, [chartSeries])

  const option: EChartsOption = {
    animation: false,
    grid: {
      top: 30,
      left: 60,
      right: legendWidthPx + legendRightOffsetPx,
      bottom: 84,
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: legendRightOffsetPx,
      top: 32,
      bottom: 32,
      width: legendWidthPx,
      itemHeight: 10,
      itemWidth: 18,
      data: series.map((item) => ({
        name: item.label,
        textStyle: {
          color: item.color,
          fontWeight: 600,
        },
      })),
      textStyle: {
        color: themeColors.muted,
      },
      icon: undefined,
    },
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove|click',
      alwaysShowContent: true,
      appendToBody: true,
      backgroundColor: themeColors.panel,
      borderColor: themeColors.border,
      borderWidth: 1,
      textStyle: {
        color: themeColors.foreground,
      },
      formatter: (params) => {
        const entry = params as {
          data?: TooltipPointPayload
          seriesName?: string
        }
        const payload = entry.data
        if (!payload) {
          return ''
        }

        const actorName = escapeHtml(
          String(entry.seriesName ?? 'Unknown actor'),
        )
        const actorColor = escapeHtml(String(payload.actorColor ?? '#94a3b8'))
        const abilityName = escapeHtml(payload.abilityName ?? 'Unknown ability')
        const modifiers = formatTooltipModifiers(payload.modifiers ?? 'none')
        const formula = escapeHtml(payload.formula ?? 'n/a')
        const timeMs = Number(payload.timeMs ?? 0)
        const totalThreat = Number(payload.totalThreat ?? 0)
        const threatDelta = Number(payload.threatDelta ?? 0)
        const amount = Number(payload.amount ?? 0)
        const baseThreat = Number(payload.baseThreat ?? 0)
        const eventType = escapeHtml(payload.eventType ?? 'unknown')
        const actorId = Number(payload.actorId ?? 0)
        const sourceSeries =
          series.find((item) => item.actorId === actorId) ?? null
        const auraStatus = sourceSeries
          ? resolveThreatStateStatus(sourceSeries, timeMs)
          : { color: null, label: 'normal' }
        const statusLabel = escapeHtml(auraStatus.label)
        const statusColor = escapeHtml(auraStatus.color ?? themeColors.muted)
        const auraLine =
          auraStatus.color && auraStatus.label
            ? `Aura: <strong style="color:${statusColor};">${statusLabel}</strong>`
            : null
        const multipliersLines =
          modifiers.length === 0
            ? ['Multipliers: none']
            : [
                'Multipliers:',
                ...modifiers.map(
                  (modifier) => `&nbsp;&nbsp;&bull; ${escapeHtml(modifier)}`,
                ),
              ]

        return [
          `<strong style="color:${actorColor};">${actorName}</strong>`,
          `Time: ${formatTimelineTime(timeMs)}`,
          `Ability: ${abilityName} [${eventType}]`,
          `Amount: ${formatNumber(amount)}`,
          `Formula: ${formula}`,
          `Base Threat: ${formatNumber(baseThreat)}`,
          `Threat Applied To Target: ${formatSignedThreat(threatDelta)}`,
          `Cumulative Threat: ${formatNumber(totalThreat)}`,
          ...multipliersLines,
          ...(auraLine ? [auraLine] : []),
        ].join('<br/>')
      },
    },
    xAxis: {
      type: 'value',
      min: bounds.min,
      max: bounds.max,
      axisLabel: {
        color: themeColors.muted,
        formatter: (value: number) => formatTimelineTime(value),
      },
      axisLine: {
        lineStyle: {
          color: themeColors.border,
        },
      },
      splitLine: {
        lineStyle: {
          color: themeColors.border,
          opacity: 0.4,
        },
      },
    },
    yAxis: {
      type: 'value',
      name: 'Threat',
      nameTextStyle: {
        color: themeColors.muted,
      },
      axisLabel: {
        color: themeColors.muted,
      },
      axisLine: {
        lineStyle: {
          color: themeColors.border,
        },
      },
      splitLine: {
        lineStyle: {
          color: themeColors.border,
          opacity: 0.4,
        },
      },
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'none',
        startValue,
        endValue,
        labelFormatter: (value: number) => formatTimelineTime(value),
      },
      {
        type: 'slider',
        xAxisIndex: 0,
        filterMode: 'none',
        height: 20,
        bottom: 24,
        startValue,
        endValue,
        labelFormatter: (value: number) => formatTimelineTime(value),
      },
    ],
    visualMap: threatStateVisualMaps.length > 0 ? threatStateVisualMaps : undefined,
    series: chartSeries.map((item, seriesIndex) => {
      const pinnedPoint =
        pinnedTooltip?.seriesIndex === seriesIndex
          ? item.data[pinnedTooltip.dataIndex]
          : null

      return {
        name: item.name,
        type: 'line',
        color: item.color,
        step: 'end',
        smooth: false,
        symbol: 'circle',
        showSymbol: true,
        symbolSize: 6,
        triggerLineEvent: true,
        animation: false,
        itemStyle: {
          color: item.color,
          borderColor: item.color,
        },
        emphasis: {
          focus: 'series',
          scale: true,
          lineStyle: {
            width: 3,
          },
        },
        lineStyle: {
          type: item.actorType === 'Pet' ? 'dashed' : 'solid',
          width: 2,
        },
        markArea: buildAuraMarkArea({
          fixateWindows: series[seriesIndex]?.fixateWindows ?? [],
          invulnerabilityWindows: [],
        }),
        markPoint: pinnedPoint
          ? {
              symbol: 'circle',
              symbolSize: 8,
              silent: true,
              z: 20,
              zlevel: 2,
              animation: false,
              data: [{ coord: pinnedPoint.value }],
              label: {
                show: false,
              },
              itemStyle: {
                color: item.color,
                borderColor: '#ffffff',
                borderWidth: 1,
                shadowBlur: 10,
                shadowColor: item.color,
              },
            }
          : undefined,
        data: item.data,
      }
    }),
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-md border border-border bg-panel px-2 py-1 text-xs"
          type="button"
          onClick={() => onWindowChange(null, null)}
        >
          Reset zoom
        </button>
        {visibleIsolatedActorId !== null ? (
          <button
            className="rounded-md border border-border bg-panel px-2 py-1 text-xs"
            type="button"
            onClick={() => {
              const chart = chartRef.current?.getEchartsInstance()
              if (!chart) {
                return
              }

              resetLegendSelection(chart, legendNames)
              setIsolatedActorId(null)
            }}
          >
            Clear isolate
          </button>
        ) : null}
      </div>
      <ReactEChartsCore
        echarts={echarts}
        ref={chartRef}
        notMerge
        opts={{ renderer }}
        option={option}
        style={{ height: 560, width: '100%' }}
        onEvents={{
          datazoom: (params: {
            batch?: Array<{ startValue?: number; endValue?: number }>
            startValue?: number
            endValue?: number
          }) => {
            const batch = params.batch?.[0]
            const nextStart = Math.round(
              batch?.startValue ?? params.startValue ?? bounds.min,
            )
            const nextEnd = Math.round(
              batch?.endValue ?? params.endValue ?? bounds.max,
            )

            if (nextStart <= bounds.min && nextEnd >= bounds.max) {
              onWindowChange(null, null)
              return
            }

            onWindowChange(nextStart, nextEnd)
          },
          legendselectchanged: (params: {
            name: string
            selected: Record<string, boolean>
          }) => {
            const chart = chartRef.current?.getEchartsInstance()
            if (!chart) {
              return
            }

            const clickedActorId = actorIdByLabel.get(params.name)
            if (!clickedActorId) {
              return
            }

            const now = Date.now()
            const previousClick = lastLegendClickRef.current
            const isDoubleClick =
              previousClick?.name === params.name &&
              now - previousClick.timestamp <= doubleClickThresholdMs

            lastLegendClickRef.current = {
              name: params.name,
              timestamp: now,
            }

            if (!isDoubleClick) {
              return
            }

            if (visibleIsolatedActorId === clickedActorId) {
              resetLegendSelection(chart, legendNames)
              setIsolatedActorId(null)
              return
            }

            isolateLegendSelection(chart, params.name, legendNames)
            setIsolatedActorId(clickedActorId)
          },
          click: (params: {
            componentType?: string
            seriesName?: string
            data?: Record<string, unknown>
            seriesType?: string
          }) => {
            if (
              params.componentType !== 'series' ||
              params.seriesType !== 'line'
            ) {
              return
            }

            const payloadPlayerId = Number(params.data?.playerId)
            if (Number.isFinite(payloadPlayerId) && payloadPlayerId > 0) {
              onSeriesClick(payloadPlayerId)
              return
            }

            if (!params.seriesName) {
              return
            }

            const clickedPlayerId = playerIdByLabel.get(params.seriesName)
            if (!clickedPlayerId) {
              return
            }

            onSeriesClick(clickedPlayerId)
          },
        }}
      />
    </div>
  )
}
