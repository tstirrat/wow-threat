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

import { formatTimelineTime } from '../lib/format'
import { resolveSeriesWindowBounds } from '../lib/threat-aggregation'
import {
  buildAuraMarkArea,
  buildThreatStateVisualMaps,
  resolveThreatStateStatus,
} from '../lib/threat-chart-visuals'
import type { ThreatPointModifier, ThreatSeries } from '../types/app'

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
  spellSchool: string | null
  modifiers: ThreatPointModifier[]
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
  return `${prefix}${formatTooltipNumber(Math.abs(value))}`
}

function formatTooltipNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function resolveSchoolColor(school: string | null): string | null {
  if (!school || school === 'physical' || school.includes('/')) {
    return null
  }

  const bySchool: Record<string, string> = {
    holy: '#f59e0b',
    fire: '#ef4444',
    nature: '#22c55e',
    frost: '#38bdf8',
    shadow: '#a78bfa',
    arcane: '#06b6d4',
  }

  return bySchool[school] ?? null
}

function resolveSplitCount(modifiedThreat: number, threatDelta: number): number {
  if (modifiedThreat === 0 || threatDelta === 0) {
    return 1
  }

  const ratio = Math.abs(modifiedThreat / threatDelta)
  const rounded = Math.round(ratio)
  if (!Number.isFinite(ratio) || rounded <= 1) {
    return 1
  }

  return Math.abs(ratio - rounded) < 0.001 ? rounded : 1
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
  const chartContainerRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    const container = chartContainerRef.current
    if (!container) {
      return
    }

    const handleWheelCapture = (event: WheelEvent): void => {
      if (event.shiftKey) {
        return
      }

      event.stopPropagation()
    }

    container.addEventListener('wheel', handleWheelCapture, true)
    return () => {
      container.removeEventListener('wheel', handleWheelCapture, true)
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
        const modifiers = payload.modifiers ?? []
        const timeMs = Number(payload.timeMs ?? 0)
        const totalThreat = Number(payload.totalThreat ?? 0)
        const threatDelta = Number(payload.threatDelta ?? 0)
        const amount = Number(payload.amount ?? 0)
        const modifiedThreat = Number(payload.modifiedThreat ?? 0)
        const spellSchool = payload.spellSchool?.toLowerCase() ?? null
        const rawEventType = String(payload.eventType ?? 'unknown').toLowerCase()
        const eventType = escapeHtml(rawEventType)
        const abilityEventSuffix =
          rawEventType === 'damage' || rawEventType === 'heal'
            ? ''
            : ` (${eventType})`
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
        const splitCount = resolveSplitCount(modifiedThreat, threatDelta)
        const visibleModifiers = modifiers.filter(
          (modifier) =>
            Number.isFinite(modifier.value) && Math.abs(modifier.value - 1) > 0.0005,
        )
        const modifiersTotal = visibleModifiers.reduce((total, modifier) => {
          if (!Number.isFinite(modifier.value)) {
            return total
          }

          return total * modifier.value
        }, 1)
        const amountSchool =
          spellSchool && spellSchool !== 'physical'
          ? ` (${escapeHtml(spellSchool)})`
          : ''
        const amountColor =
          rawEventType === 'heal'
            ? '#22c55e'
            : resolveSchoolColor(spellSchool)
        const modifierLines = visibleModifiers.map((modifier) => {
          const schoolsLabel = modifier.schools
            .filter((school) => school !== 'physical')
            .join('/')
          const rowSchool =
            modifier.schools.length === 1
              ? modifier.schools[0] ?? null
              : modifier.schools.length === 0
                ? spellSchool
                : null
          const color = resolveSchoolColor(rowSchool)
          const schoolSuffix =
            schoolsLabel.length > 0
              ? ` (${escapeHtml(schoolsLabel)})`
              : ''
          const value = Number.isFinite(modifier.value)
            ? formatTooltipNumber(modifier.value)
            : '-'
          return `<div style="display:flex;justify-content:space-between;gap:10px;line-height:1.2;${color ? `color:${color};` : ''}"><span>${escapeHtml(modifier.name)}${schoolSuffix}</span><span>${value}</span></div>`
        })

        return [
          '<div style="min-width:280px;font-size:12px;line-height:1.2;">',
          `<div style="display:flex;justify-content:space-between;gap:10px;line-height:1.2;"><strong>${abilityName}${abilityEventSuffix}</strong><strong style="color:${actorColor};">${actorName}</strong></div>`,
          `<div style="line-height:1.2;">T: ${formatTimelineTime(timeMs)}</div>`,
          `<div style="display:flex;justify-content:space-between;gap:10px;line-height:1.2;${amountColor ? `color:${amountColor};` : ''}"><span>Amt: ${formatTooltipNumber(amount)}${amountSchool}</span><span>${escapeHtml(payload.formula ?? 'n/a')}</span></div>`,
          `<div style="display:flex;justify-content:space-between;gap:10px;line-height:1.2;"><span>Threat: ${formatSignedThreat(threatDelta)}${splitCount > 1 ? ` / ${splitCount}` : ''}</span><span>&sum; ${formatTooltipNumber(totalThreat)}</span></div>`,
          ...(visibleModifiers.length > 0
            ? [
                '<div style="padding-left:2ch;">',
                `<div style="display:flex;justify-content:space-between;gap:10px;line-height:1.2;"><span>Multipliers:</span><span>&sum; ${formatTooltipNumber(modifiersTotal)}</span></div>`,
              ]
            : []),
          ...modifierLines,
          ...(visibleModifiers.length > 0 ? ['</div>'] : []),
          ...(auraLine ? [auraLine] : []),
          '</div>',
        ].join('')
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
        zoomOnMouseWheel: 'shift',
        moveOnMouseWheel: false,
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
    visualMap:
      threatStateVisualMaps.length > 0 ? threatStateVisualMaps : undefined,
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
      <div ref={chartContainerRef}>
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
    </div>
  )
}
