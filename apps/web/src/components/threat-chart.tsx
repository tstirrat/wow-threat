/**
 * ECharts threat timeline with deep-linkable zoom and a custom legend panel.
 */
import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { useThreatChartLegendState } from '../hooks/use-threat-chart-legend-state'
import { useThreatChartPlayerSearch } from '../hooks/use-threat-chart-player-search'
import { useThreatChartSelectedWindow } from '../hooks/use-threat-chart-selected-window'
import { useThreatChartSeriesClickHandler } from '../hooks/use-threat-chart-series-click-handler'
import { useThreatChartSeriesData } from '../hooks/use-threat-chart-series-data'
import { useThreatChartThemeColors } from '../hooks/use-threat-chart-theme-colors'
import { useThreatChartVisiblePlayers } from '../hooks/use-threat-chart-visible-players'
import { useThreatChartZoom } from '../hooks/use-threat-chart-zoom'
import { formatTimelineTime } from '../lib/format'
import { resolveSeriesWindowBounds } from '../lib/threat-aggregation'
import {
  loadShowFixateBandsPreference,
  saveShowFixateBandsPreference,
} from '../lib/threat-chart-fixate-bands-preference'
import { resolvePointSize } from '../lib/threat-chart-point-size'
import { createThreatChartTooltipFormatter } from '../lib/threat-chart-tooltip'
import type { SeriesChartPoint } from '../lib/threat-chart-types'
import { buildAuraMarkArea } from '../lib/threat-chart-visuals'
import type { BossDamageMode, ThreatSeries } from '../types/app'
import { ThreatChartControls } from './threat-chart-controls'
import { ThreatChartLegend } from './threat-chart-legend'
import { ThreatChartPlayerSearch } from './threat-chart-player-search'

export type ThreatChartProps = {
  series: ThreatSeries[]
  selectedPlayerIds?: number[]
  pinnedPlayerIds?: number[]
  focusedActorId?: number | null
  renderer?: 'canvas' | 'svg'
  windowStartMs: number | null
  windowEndMs: number | null
  onWindowChange: (startMs: number | null, endMs: number | null) => void
  onFocusAndAddPlayer: (playerId: number) => void
  onFocusAndIsolatePlayer: (playerId: number) => void
  onTogglePinnedPlayer: (playerId: number) => void
  onSeriesClick: (actorId: number) => void
  onVisiblePlayerIdsChange?: (playerIds: number[]) => void
  onClearSelections?: () => void
  showPets: boolean
  onShowPetsChange: (showPets: boolean) => void
  showEnergizeEvents: boolean
  onShowEnergizeEventsChange: (showEnergizeEvents: boolean) => void
  bossDamageMode: BossDamageMode
  onBossDamageModeChange: (bossDamageMode: BossDamageMode) => void
  inferThreatReduction: boolean
  onInferThreatReductionChange: (inferThreatReduction: boolean) => void
}

export const ThreatChart: FC<ThreatChartProps> = ({
  series,
  selectedPlayerIds = [],
  pinnedPlayerIds = [],
  focusedActorId = null,
  renderer = 'canvas',
  windowStartMs,
  windowEndMs,
  onWindowChange,
  onFocusAndAddPlayer,
  onFocusAndIsolatePlayer,
  onTogglePinnedPlayer,
  onSeriesClick,
  onVisiblePlayerIdsChange,
  onClearSelections,
  showPets,
  onShowPetsChange,
  showEnergizeEvents,
  onShowEnergizeEventsChange,
  bossDamageMode,
  onBossDamageModeChange,
  inferThreatReduction,
  onInferThreatReductionChange,
}) => {
  const chartRef = useRef<ReactEChartsCore>(null)
  const [isChartReady, setIsChartReady] = useState(false)
  const [showFixateBands, setShowFixateBands] = useState(
    loadShowFixateBandsPreference,
  )
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
  const { consumeSuppressedSeriesClick, resetZoom, yAxisWindow } =
    useThreatChartZoom({
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
      bossDamageMode,
    })

  const { allPlayerIds, hasHiddenActors } = useThreatChartVisiblePlayers({
    clearIsolate,
    isActorVisible,
    onVisiblePlayerIdsChange,
    series,
  })
  const {
    filteredPlayerSearchOptions,
    handlePlayerSearchInputKeyDown,
    isPlayerSearchOpen,
    openPlayerSearch,
    closePlayerSearch,
    isolateFocusedPlayer,
    playerSearchQuery,
    resolvedHighlightedPlayerId,
    selectPlayer,
    setHighlightedPlayerId,
    setPlayerSearchQuery,
  } = useThreatChartPlayerSearch({
    clearIsolate,
    focusedActorId,
    onFocusAndAddPlayer,
    onFocusAndIsolatePlayer,
    series,
  })
  const canClearIsolate = visibleIsolatedActorId !== null || hasHiddenActors
  const handleClearSelections = useCallback((): void => {
    clearIsolate()
    if (onClearSelections) {
      onClearSelections()
      return
    }

    onVisiblePlayerIdsChange?.(allPlayerIds)
  }, [allPlayerIds, clearIsolate, onClearSelections, onVisiblePlayerIdsChange])

  useEffect(() => {
    saveShowFixateBandsPreference(showFixateBands)
  }, [showFixateBands])

  useHotkeys(
    '/',
    (event) => {
      // Playwright reports Shift+/ as "/" with this useKey binding, so guard
      // Shift to avoid opening player search when requesting the shortcuts panel.
      if (event.shiftKey) {
        return
      }

      event.preventDefault()
      openPlayerSearch()
    },
    {
      description: 'Open player search',
      metadata: {
        order: 60,
        showInFightOverlay: true,
      },
      scopes: ['fight-page'],
      useKey: true,
    },
    [openPlayerSearch],
  )

  useHotkeys(
    'c',
    (event) => {
      if (!canClearIsolate) {
        return
      }

      event.preventDefault()
      handleClearSelections()
    },
    {
      description: 'Clear isolate',
      metadata: {
        order: 40,
        showInFightOverlay: true,
      },
      scopes: ['fight-page'],
    },
    [canClearIsolate, handleClearSelections],
  )

  useHotkeys(
    'i',
    (event) => {
      event.preventDefault()
      isolateFocusedPlayer()
    },
    {
      description: 'Isolate focused player',
      metadata: {
        order: 50,
        showInFightOverlay: true,
      },
      scopes: ['fight-page'],
    },
    [isolateFocusedPlayer],
  )

  useHotkeys(
    'escape',
    (event) => {
      event.preventDefault()
      closePlayerSearch()
    },
    {
      enabled: isPlayerSearchOpen,
      scopes: ['fight-page'],
    },
    [closePlayerSearch, isPlayerSearchOpen],
  )

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
      extraCssText: 'z-index: 40;',
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
      min: yAxisWindow?.min,
      max: yAxisWindow?.max,
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
          fixateWindows: showFixateBands
            ? (visibleSeries[seriesIndex]?.fixateWindows ?? [])
            : [],
          invulnerabilityWindows: [],
        }),
        data: item.data,
      }
    }),
  }

  return (
    <div className="space-y-3">
      <ThreatChartControls
        onResetZoom={resetZoom}
        showFixateBands={showFixateBands}
        onShowFixateBandsChange={setShowFixateBands}
        showEnergizeEvents={showEnergizeEvents}
        onShowEnergizeEventsChange={onShowEnergizeEventsChange}
        bossDamageMode={bossDamageMode}
        onBossDamageModeChange={onBossDamageModeChange}
        inferThreatReduction={inferThreatReduction}
        onInferThreatReductionChange={onInferThreatReductionChange}
      />
      <ThreatChartPlayerSearch
        isOpen={isPlayerSearchOpen}
        query={playerSearchQuery}
        options={filteredPlayerSearchOptions}
        highlightedPlayerId={resolvedHighlightedPlayerId}
        onClose={closePlayerSearch}
        onQueryChange={setPlayerSearchQuery}
        onInputKeyDown={handlePlayerSearchInputKeyDown}
        onHighlightPlayer={setHighlightedPlayerId}
        onSelectPlayer={(playerId) => {
          selectPlayer({
            playerId,
            shouldAddToFilter: false,
          })
        }}
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
          pinnedPlayerIds={pinnedPlayerIds}
          onTogglePinnedPlayer={onTogglePinnedPlayer}
          showClearSelections={canClearIsolate}
          onClearSelections={handleClearSelections}
          showPets={showPets}
          onShowPetsChange={onShowPetsChange}
        />
      </div>
    </div>
  )
}
