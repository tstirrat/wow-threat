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
  useThreatChartPinnedTooltip,
} from '../hooks/use-threat-chart-pinned-tooltip'
import { useThreatChartThemeColors } from '../hooks/use-threat-chart-theme-colors'
import { formatTimelineTime } from '../lib/format'
import { resolveSeriesWindowBounds } from '../lib/threat-aggregation'
import { resolvePointSize } from '../lib/threat-chart-point-size'
import {
  bossMeleeMarkerColor,
  createThreatChartTooltipFormatter,
  deathMarkerColor,
} from '../lib/threat-chart-tooltip'
import {
  buildAuraMarkArea,
  buildThreatStateVisualMaps,
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

  return seriesColor
}

export type ThreatChartProps = {
  series: ThreatSeries[]
  selectedPlayerIds?: number[]
  renderer?: 'canvas' | 'svg'
  windowStartMs: number | null
  windowEndMs: number | null
  onWindowChange: (startMs: number | null, endMs: number | null) => void
  onSeriesClick: (actorId: number) => void
  onVisiblePlayerIdsChange?: (playerIds: number[]) => void
  showPets: boolean
  onShowPetsChange: (showPets: boolean) => void
}

export const ThreatChart: FC<ThreatChartProps> = ({
  series,
  selectedPlayerIds = [],
  renderer = 'canvas',
  windowStartMs,
  windowEndMs,
  onWindowChange,
  onSeriesClick,
  onVisiblePlayerIdsChange,
  showPets,
  onShowPetsChange,
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
  } = useThreatChartLegendState(series, selectedPlayerIds)

  const bounds = resolveSeriesWindowBounds(series)

  const actorIdByLabel = new Map(
    series.map((item) => [item.label, item.actorId]),
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
        const toDataPoint = (
          point: ThreatSeries['points'][number],
        ): SeriesChartPoint => ({
          ...point,
          actorId: item.actorId,
          actorColor: item.color,
          focusedActorId: item.actorId,
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
  const visiblePlayerIds = useMemo(
    () =>
      series
        .filter((item) => item.actorType === 'Player')
        .filter((item) => isActorVisible(item.actorId))
        .map((item) => item.actorId)
        .sort((a, b) => a - b),
    [isActorVisible, series],
  )
  const allPlayerIds = useMemo(
    () =>
      series
        .filter((item) => item.actorType === 'Player')
        .map((item) => item.actorId)
        .sort((a, b) => a - b),
    [series],
  )
  const hasHiddenActors = useMemo(
    () => series.some((item) => !isActorVisible(item.actorId)),
    [isActorVisible, series],
  )

  useEffect(() => {
    onVisiblePlayerIdsChange?.(visiblePlayerIds)
  }, [onVisiblePlayerIdsChange, visiblePlayerIds])
  const handleClearIsolate = useCallback((): void => {
    clearIsolate()
    onVisiblePlayerIdsChange?.(allPlayerIds)
  }, [allPlayerIds, clearIsolate, onVisiblePlayerIdsChange])
  const tooltipFormatter = createThreatChartTooltipFormatter({
    series,
    themeColors,
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
      formatter: tooltipFormatter,
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
        symbolSize: (
          _value: unknown,
          params: { data?: SeriesChartPoint } | undefined,
        ) => resolvePointSize(params?.data),
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
        showClearIsolate={visibleIsolatedActorId !== null || hasHiddenActors}
        onResetZoom={resetZoom}
        onClearIsolate={handleClearIsolate}
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

                const payloadActorId = Number(params.data?.focusedActorId)
                if (Number.isFinite(payloadActorId) && payloadActorId > 0) {
                  onSeriesClick(payloadActorId)
                  return
                }

                if (!params.seriesName) {
                  return
                }

                const clickedActorId = actorIdByLabel.get(params.seriesName)
                if (!clickedActorId) {
                  return
                }

                onSeriesClick(clickedActorId)
              },
            }}
          />
        </div>
        <ThreatChartLegend
          series={series}
          isActorVisible={isActorVisible}
          onActorClick={handleLegendItemClick}
          showPets={showPets}
          onShowPetsChange={onShowPetsChange}
        />
      </div>
    </div>
  )
}
