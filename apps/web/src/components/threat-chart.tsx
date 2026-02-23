/**
 * ECharts threat timeline with deep-linkable zoom and a custom legend panel.
 */
import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import {
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useThreatChartFisheye } from '../hooks/use-threat-chart-fisheye'
import { useThreatChartLegendState } from '../hooks/use-threat-chart-legend-state'
import { useThreatChartThemeColors } from '../hooks/use-threat-chart-theme-colors'
import { formatTimelineTime } from '../lib/format'
import { resolveSeriesWindowBounds } from '../lib/threat-aggregation'
import { shouldRenderThreatPoint } from '../lib/threat-chart-event-visibility'
import { resolvePointSize } from '../lib/threat-chart-point-size'
import {
  bossMeleeMarkerColor,
  createThreatChartTooltipFormatter,
  deathMarkerColor,
} from '../lib/threat-chart-tooltip'
import type { SeriesChartPoint } from '../lib/threat-chart-types'
import {
  buildAuraMarkArea,
  buildThreatStateVisualMaps,
} from '../lib/threat-chart-visuals'
import type { ThreatSeries } from '../types/app'
import { ThreatChartControls } from './threat-chart-controls'
import { ThreatChartLegend } from './threat-chart-legend'

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
  showEnergizeEvents: boolean
  onShowEnergizeEventsChange: (showEnergizeEvents: boolean) => void
}

export const ThreatChart: FC<ThreatChartProps> = ({
  series,
  selectedPlayerIds = [],
  renderer = 'canvas',
  onWindowChange,
  onSeriesClick,
  onVisiblePlayerIdsChange,
  showPets,
  onShowPetsChange,
  showEnergizeEvents,
  onShowEnergizeEventsChange,
}) => {
  const chartRef = useRef<ReactEChartsCore>(null)
  const [isChartReady, setIsChartReady] = useState(false)
  const themeColors = useThreatChartThemeColors()
  const {
    visibleSeries,
    visibleIsolatedActorId,
    isActorVisible,
    clearIsolate,
    handleLegendItemClick,
  } = useThreatChartLegendState(series, selectedPlayerIds)

  const bounds = resolveSeriesWindowBounds(series)
  const { axisBreaks, consumeSuppressedSeriesClick, resetZoom } =
    useThreatChartFisheye({
      bounds,
      borderColor: themeColors.border,
      chartRef,
      isChartReady,
      onWindowChange,
      renderer,
    })

  const actorIdByLabel = new Map(
    series.map((item) => [item.label, item.actorId]),
  )

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
          data: item.points
            .filter((point) =>
              shouldRenderThreatPoint({ point, showEnergizeEvents }),
            )
            .map(toDataPoint),
          name: item.label,
        }
      }),
    [showEnergizeEvents, visibleSeries],
  )

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
      bottom: 36,
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
      breaks: axisBreaks,
      breakArea: {
        expandOnClick: false,
        zigzagAmplitude: 0,
        zigzagZ: 200,
        itemStyle: {
          color: themeColors.border,
          borderColor: themeColors.border,
          borderWidth: 1,
          opacity: 0.12,
        },
      },
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
    visualMap:
      threatStateVisualMaps.length > 0 ? threatStateVisualMaps : undefined,
    series: chartSeries.map((item, seriesIndex) => {
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
        showEnergizeEvents={showEnergizeEvents}
        onShowEnergizeEventsChange={onShowEnergizeEventsChange}
      />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div>
          <ReactEChartsCore
            echarts={echarts}
            ref={chartRef}
            notMerge
            opts={{ renderer }}
            option={option}
            style={{ height: 560, width: '100%' }}
            onChartReady={() => {
              setIsChartReady(true)
            }}
            onEvents={{
              click: (params: {
                componentType?: string
                seriesName?: string
                data?: Record<string, unknown>
                seriesType?: string
              }) => {
                if (consumeSuppressedSeriesClick()) {
                  return
                }

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
          onActorFocus={onSeriesClick}
          showPets={showPets}
          onShowPetsChange={onShowPetsChange}
        />
      </div>
    </div>
  )
}
