/**
 * ECharts threat timeline with deep-linkable zoom and a custom legend panel.
 */
import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { type FC, useRef, useState } from 'react'

import { useThreatChartLegendState } from '../hooks/use-threat-chart-legend-state'
import { useThreatChartSelectedWindow } from '../hooks/use-threat-chart-selected-window'
import { useThreatChartSeriesClickHandler } from '../hooks/use-threat-chart-series-click-handler'
import { useThreatChartSeriesData } from '../hooks/use-threat-chart-series-data'
import { useThreatChartThemeColors } from '../hooks/use-threat-chart-theme-colors'
import { useThreatChartVisiblePlayers } from '../hooks/use-threat-chart-visible-players'
import { useThreatChartZoom } from '../hooks/use-threat-chart-zoom'
import { formatTimelineTime } from '../lib/format'
import { resolveSeriesWindowBounds } from '../lib/threat-aggregation'
import { resolvePointSize } from '../lib/threat-chart-point-size'
import { createThreatChartTooltipFormatter } from '../lib/threat-chart-tooltip'
import type { SeriesChartPoint } from '../lib/threat-chart-types'
import { buildAuraMarkArea } from '../lib/threat-chart-visuals'
import type { ThreatSeries } from '../types/app'
import { ThreatChartControls } from './threat-chart-controls'
import { ThreatChartLegend } from './threat-chart-legend'

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
  showBossMelee: boolean
  onShowBossMeleeChange: (showBossMelee: boolean) => void
  inferThreatReduction: boolean
  onInferThreatReductionChange: (inferThreatReduction: boolean) => void
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
  showEnergizeEvents,
  onShowEnergizeEventsChange,
  showBossMelee,
  onShowBossMeleeChange,
  inferThreatReduction,
  onInferThreatReductionChange,
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
  const selectedWindow = useThreatChartSelectedWindow({
    bounds,
    windowStartMs,
    windowEndMs,
  })
  const { consumeSuppressedSeriesClick, resetZoom } = useThreatChartZoom({
    bounds,
    borderColor: themeColors.border,
    chartRef,
    isChartReady,
    onWindowChange,
    renderer,
  })

  const { actorIdByLabel, chartSeries, threatStateVisualMaps } =
    useThreatChartSeriesData({
      series,
      visibleSeries,
      showEnergizeEvents,
      showBossMelee,
    })

  const { hasHiddenActors, handleClearIsolate } = useThreatChartVisiblePlayers({
    clearIsolate,
    isActorVisible,
    onVisiblePlayerIdsChange,
    series,
  })

  const handleSeriesChartClick = useThreatChartSeriesClickHandler({
    actorIdByLabel,
    consumeSuppressedSeriesClick,
    onSeriesClick,
  })

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
      min: selectedWindow?.start ?? bounds.min,
      max: selectedWindow?.end ?? bounds.max,
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
          color: item.color,
          borderColor: item.color,
        },
        emphasis: {
          focus: 'series',
          scale: true,
          itemStyle: {
            color: item.color,
            borderColor: item.color,
          },
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
        showBossMelee={showBossMelee}
        onShowBossMeleeChange={onShowBossMeleeChange}
        inferThreatReduction={inferThreatReduction}
        onInferThreatReductionChange={onInferThreatReductionChange}
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
              click: handleSeriesChartClick,
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
