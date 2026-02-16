/**
 * ECharts threat timeline with deep-linkable zoom and a custom legend panel.
 */
import type { EChartsOption } from 'echarts'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  MarkAreaComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers'
import { type FC, useCallback, useEffect, useMemo, useRef } from 'react'

import { useThreatChartLegendState } from '../hooks/use-threat-chart-legend-state'
import {
  type SeriesChartPoint,
  type TooltipPointPayload,
  useThreatChartPinnedTooltip,
} from '../hooks/use-threat-chart-pinned-tooltip'
import { useThreatChartThemeColors } from '../hooks/use-threat-chart-theme-colors'
import { formatTimelineTime } from '../lib/format'
import { resolveSeriesWindowBounds } from '../lib/threat-aggregation'
import {
  buildAuraMarkArea,
  buildThreatStateVisualMaps,
  resolveThreatStateStatus,
} from '../lib/threat-chart-visuals'
import {
  type DataZoomWindowPayload,
  isFullWindowRange,
  resolveDataZoomWindowRange,
} from '../lib/threat-chart-window'
import type { ThreatSeries } from '../types/app'
import { ThreatChartControls } from './threat-chart-controls'
import { ThreatChartLegend } from './threat-chart-legend'

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkAreaComponent,
  MarkPointComponent,
  CanvasRenderer,
  SVGRenderer,
])

const bossMeleeMarkerColor = '#ef4444'
const deathMarkerColor = '#dc2626'
const invulnerabilityMarkerColor = '#22c55e'

function resolvePointColor(
  point: SeriesChartPoint | undefined,
  seriesColor: string,
): string {
  if (!point?.markerKind) {
    return seriesColor
  }

  if (point.markerKind === 'bossMelee') {
    return bossMeleeMarkerColor
  }

  if (point.markerKind === 'death') {
    return deathMarkerColor
  }

  if (point.markerKind === 'invulnerabilityStart') {
    return invulnerabilityMarkerColor
  }

  return seriesColor
}

function resolvePointSize(point: SeriesChartPoint | undefined): number {
  if (point?.markerKind) {
    return 8
  }

  return 6
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
    // Core spell schools (overrides)
    holy: '#f2e699',
    fire: '#ef4444',
    nature: '#22c55e',
    frost: '#38bdf8',
    shadow: '#a78bfa',
    arcane: '#06b6d4',
  }

  return bySchool[school] ?? null
}

function resolveSplitCount(
  modifiedThreat: number,
  threatDelta: number,
): number {
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
  const themeColors = useThreatChartThemeColors()
  const {
    visibleSeries,
    visibleIsolatedActorId,
    isActorVisible,
    clearIsolate,
    handleLegendItemClick,
  } = useThreatChartLegendState(series)

  const bounds = resolveSeriesWindowBounds(series)

  const playerIdByLabel = new Map(
    series.map((item) => [
      item.label,
      item.actorType === 'Player' ? item.actorId : item.ownerId,
    ]),
  )

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
  const threatStateVisualMaps = buildThreatStateVisualMaps(visibleSeries)
  const chartSeries = useMemo(
    () =>
      visibleSeries.map((item) => {
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
          actorId: item.actorId,
          actorType: item.actorType,
          color: item.color,
          data: item.points.map(toDataPoint),
          name: item.label,
        }
      }),
    [visibleSeries],
  )

  const resetZoom = useCallback((): void => {
    const chart = chartRef.current?.getEchartsInstance()
    if (!chart) {
      return
    }

    chart.dispatchAction({
      type: 'dataZoom',
      startValue: bounds.min,
      endValue: bounds.max,
    })
    onWindowChange(null, null)
  }, [bounds.max, bounds.min, onWindowChange])
  const pinnedTooltip = useThreatChartPinnedTooltip({
    chartRef,
    chartSeries,
  })

  const option: EChartsOption = {
    animation: false,
    grid: {
      top: 30,
      left: 60,
      right: 20,
      bottom: 84,
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
        const markerKind = payload.markerKind ?? null
        const spellSchool = payload.spellSchool?.toLowerCase() ?? null
        const rawEventType = String(
          payload.eventType ?? 'unknown',
        ).toLowerCase()
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
        const markerLine =
          markerKind === 'bossMelee'
            ? `Marker: <strong style="color:${bossMeleeMarkerColor};">Boss melee</strong>`
            : markerKind === 'death'
              ? `Marker: <strong style="color:${deathMarkerColor};">Death</strong>`
              : markerKind === 'invulnerabilityStart'
                ? `Marker: <strong style="color:${invulnerabilityMarkerColor};">Invulnerability applied</strong>`
                : null
        const splitCount = resolveSplitCount(modifiedThreat, threatDelta)
        const visibleModifiers = modifiers.filter(
          (modifier) =>
            Number.isFinite(modifier.value) &&
            Math.abs(modifier.value - 1) > 0.0005,
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
          rawEventType === 'heal' ? '#22c55e' : resolveSchoolColor(spellSchool)
        const modifierLines = visibleModifiers.map((modifier) => {
          const schoolsLabel = modifier.schoolLabels
            .filter((school) => school !== 'physical')
            .join('/')
          const rowSchool =
            modifier.schoolLabels.length === 1
              ? (modifier.schoolLabels[0] ?? null)
              : null
          const color = resolveSchoolColor(rowSchool)
          const schoolSuffix =
            schoolsLabel.length > 0 ? ` (${escapeHtml(schoolsLabel)})` : ''
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
                `<div style="display:flex;justify-content:space-between;gap:10px;line-height:1.2;"><span>Multipliers:</span><span>&sum; ${formatTooltipNumber(modifiersTotal)}</span></div>`,
                '<div style="padding-left:2ch;">',
                ...modifierLines,
                '</div>',
              ]
            : []),
          ...(auraLine ? [auraLine] : []),
          ...(markerLine ? [markerLine] : []),
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
        pinnedTooltip?.actorId === item.actorId
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
        symbolSize: (params: { data?: SeriesChartPoint }) =>
          resolvePointSize(params.data as SeriesChartPoint),
        triggerLineEvent: true,
        animation: false,
        itemStyle: {
          color: (params: { data?: SeriesChartPoint }) =>
            resolvePointColor(params.data as SeriesChartPoint, item.color),
          borderColor: (params: { data?: SeriesChartPoint }) =>
            resolvePointColor(params.data as SeriesChartPoint, item.color),
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
          fixateWindows: visibleSeries[seriesIndex]?.fixateWindows ?? [],
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
      <ThreatChartControls
        showClearIsolate={visibleIsolatedActorId !== null}
        onResetZoom={resetZoom}
        onClearIsolate={clearIsolate}
      />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
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
                batch?: DataZoomWindowPayload[]
                start?: number
                end?: number
                startValue?: number
                endValue?: number
              }) => {
                const chart = chartRef.current?.getEchartsInstance()
                const optionDataZoom = chart?.getOption().dataZoom
                const optionPayload = Array.isArray(optionDataZoom)
                  ? (optionDataZoom[0] as DataZoomWindowPayload | undefined)
                  : undefined
                const resolvedRange = resolveDataZoomWindowRange({
                  bounds,
                  payloads: [params.batch?.[0], params, optionPayload],
                })

                if (!resolvedRange) {
                  onWindowChange(null, null)
                  return
                }

                if (
                  isFullWindowRange({
                    bounds,
                    range: resolvedRange,
                  })
                ) {
                  onWindowChange(null, null)
                  return
                }

                onWindowChange(resolvedRange.startMs, resolvedRange.endMs)
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
        <ThreatChartLegend
          series={series}
          isActorVisible={isActorVisible}
          onActorClick={handleLegendItemClick}
        />
      </div>
    </div>
  )
}
