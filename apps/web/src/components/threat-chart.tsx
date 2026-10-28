/**
 * ECharts threat timeline with deep-linkable zoom; fills its container height and
 * portals its legend into a container owned by the fight workspace.
 */
import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import { usePostHog } from 'posthog-js/react'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useHotkeys } from 'react-hotkeys-hook'

import { useThreatChartLegendState } from '../hooks/use-threat-chart-legend-state'
import { useThreatChartPlayerSearch } from '../hooks/use-threat-chart-player-search'
import { useThreatChartPlayhead } from '../hooks/use-threat-chart-playhead'
import { useThreatChartSelectedWindow } from '../hooks/use-threat-chart-selected-window'
import { useThreatChartSeriesClickHandler } from '../hooks/use-threat-chart-series-click-handler'
import { useThreatChartSeriesData } from '../hooks/use-threat-chart-series-data'
import { useThreatChartThemeColors } from '../hooks/use-threat-chart-theme-colors'
import { useThreatChartVisiblePlayers } from '../hooks/use-threat-chart-visible-players'
import { useThreatChartZoom } from '../hooks/use-threat-chart-zoom'
import { formatTimelineTime } from '../lib/format'
import { resolveSeriesWindowBounds } from '../lib/threat-aggregation'
import { resolvePointSize } from '../lib/threat-chart-point-size'
import {
  deathMarkerColor,
  playheadColor,
} from '../lib/threat-chart-tooltip-colors'
import type { SeriesChartPoint } from '../lib/threat-chart-types'
import { buildAuraMarkArea } from '../lib/threat-chart-visuals'
import type { BossDamageMode, ThreatSeries } from '../types/app'
import { ThreatChartLegend } from './threat-chart-legend'
import { ThreatChartPlayerSearch } from './threat-chart-player-search'
import { createThreatChartTooltipFormatter } from './threat-chart-tooltip'
import { Button } from './ui/button'

export type ThreatChartProps = {
  series: ThreatSeries[]
  selectedPlayerIds?: number[]
  pinnedPlayerIds?: number[]
  focusedActorId?: number | null
  zoomToggleContextKey?: string
  renderer?: 'canvas' | 'svg'
  windowStartMs: number | null
  windowEndMs: number | null
  onWindowChange: (startMs: number | null, endMs: number | null) => void
  onFocusAndAddPlayer: (playerId: number) => void
  onFocusAndIsolatePlayer: (playerId: number) => void
  onToggleFocusedPlayerIsolation: (playerId: number) => void
  onTogglePinnedPlayer: (playerId: number) => void
  onOpenPlayerOverrides: (playerId: number) => void
  actorIdsWithThreatOverrides?: ReadonlySet<number>
  onSeriesClick: (actorId: number) => void
  onVisiblePlayerIdsChange?: (playerIds: number[]) => void
  onClearSelections?: () => void
  showPets: boolean
  onShowPetsChange: (showPets: boolean) => void
  showEnergizeEvents: boolean
  bossDamageMode: BossDamageMode
  showFixateBands: boolean
  targetDeathTimeMs?: number | null
  onChartReadyChange?: (isReady: boolean) => void
  onRegisterResetZoom?: (resetZoom: (() => void) | null) => void
  isReplayMode?: boolean
  playheadMs?: number | null
  onPlayheadChange?: (timeMs: number) => void
  legendContainer?: HTMLElement | null
  fightId?: number
  reportId?: string
}

export const ThreatChart: FC<ThreatChartProps> = ({
  series,
  selectedPlayerIds = [],
  pinnedPlayerIds = [],
  focusedActorId = null,
  zoomToggleContextKey,
  renderer = 'canvas',
  windowStartMs,
  windowEndMs,
  onWindowChange,
  onFocusAndAddPlayer,
  onFocusAndIsolatePlayer,
  onToggleFocusedPlayerIsolation,
  onTogglePinnedPlayer,
  onOpenPlayerOverrides,
  actorIdsWithThreatOverrides,
  onSeriesClick,
  onVisiblePlayerIdsChange,
  onClearSelections,
  showPets,
  onShowPetsChange,
  showEnergizeEvents,
  bossDamageMode,
  showFixateBands,
  targetDeathTimeMs = null,
  onChartReadyChange,
  onRegisterResetZoom,
  isReplayMode = false,
  playheadMs = null,
  onPlayheadChange,
  legendContainer = null,
  fightId,
  reportId,
}) => {
  const chartRef = useRef<ReactEChartsCore>(null)
  const [isChartReady, setIsChartReady] = useState(false)
  const posthog = usePostHog()
  const themeColors = useThreatChartThemeColors()
  const {
    visibleSeries,
    visibleIsolatedActorId,
    isActorVisible,
    clearIsolate,
    toggleActorVisibility,
    handleLegendItemClick,
  } = useThreatChartLegendState(series, selectedPlayerIds)

  const bounds = resolveSeriesWindowBounds(series)
  const selectedWindow = useThreatChartSelectedWindow({
    bounds,
    windowStartMs,
    windowEndMs,
  })
  const {
    consumeSuppressedSeriesClick,
    isZoomed,
    resetZoom,
    toggleLastZoom,
    yAxisWindow,
  } = useThreatChartZoom({
    bounds,
    borderColor: themeColors.border,
    chartRef,
    enabled: !isReplayMode,
    isChartReady,
    onWindowChange,
    renderer,
    selectedWindow,
    zoomToggleContextKey,
  })

  useThreatChartPlayhead({
    chartRef,
    isChartReady,
    enabled: isReplayMode,
    bounds,
    onPlayheadChange: onPlayheadChange ?? (() => {}),
  })

  // Canvas can't read CSS variables, so resolve theme-aware class colors here;
  // themeColors changes identity on theme change, which re-resolves them.
  const canvasVisibleSeries = visibleSeries.map((item) => ({
    ...item,
    color: themeColors.resolveColor(item.color),
  }))

  const { actorIdByLabel, chartSeries, threatStateVisualMaps } =
    useThreatChartSeriesData({
      series,
      visibleSeries: canvasVisibleSeries,
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
    focusedPlayerId,
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
    onToggleFocusedPlayerIsolation,
    series,
    fightId,
    reportId,
    posthog,
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
    onChartReadyChange?.(isChartReady)
  }, [isChartReady, onChartReadyChange])

  useEffect(() => {
    return () => {
      onChartReadyChange?.(false)
    }
  }, [onChartReadyChange])

  useEffect(() => {
    onRegisterResetZoom?.(() => {
      resetZoom()
    })

    return () => {
      onRegisterResetZoom?.(null)
    }
  }, [onRegisterResetZoom, resetZoom])

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
    'z',
    (event) => {
      event.preventDefault()
      toggleLastZoom()
    },
    {
      description: 'Toggle last zoom',
      metadata: {
        order: 45,
        showInFightOverlay: true,
      },
      scopes: ['fight-page'],
    },
    [toggleLastZoom],
  )

  useHotkeys(
    '0',
    (event) => {
      event.preventDefault()
      resetZoom()
    },
    {
      description: 'Reset zoom',
      metadata: {
        order: 46,
        showInFightOverlay: true,
      },
      scopes: ['fight-page'],
    },
    [resetZoom],
  )

  useHotkeys(
    'shift+i',
    (event) => {
      event.preventDefault()
      isolateFocusedPlayer()
    },
    {
      description: 'Toggle isolate on focus',
      metadata: {
        order: 50,
        showInFightOverlay: true,
      },
      scopes: ['fight-page'],
    },
    [isolateFocusedPlayer],
  )

  useHotkeys(
    'p',
    (event) => {
      if (focusedPlayerId === null) {
        return
      }

      event.preventDefault()
      onTogglePinnedPlayer(focusedPlayerId)
    },
    {
      description: 'Pin / unpin focused player',
      metadata: {
        order: 51,
        showInFightOverlay: true,
      },
      scopes: ['fight-page'],
    },
    [focusedPlayerId, onTogglePinnedPlayer],
  )

  useHotkeys(
    'h',
    (event) => {
      if (focusedActorId === null) {
        return
      }

      event.preventDefault()
      toggleActorVisibility(focusedActorId)
    },
    {
      description: "Hide / show focused player's line",
      metadata: {
        order: 52,
        showInFightOverlay: true,
      },
      scopes: ['fight-page'],
    },
    [focusedActorId, toggleActorVisibility],
  )

  useHotkeys(
    'o',
    (event) => {
      if (focusedPlayerId === null) {
        return
      }

      event.preventDefault()
      onOpenPlayerOverrides(focusedPlayerId)
    },
    {
      description: 'Open threat overrides for focused player',
      metadata: {
        order: 53,
        showInFightOverlay: true,
      },
      scopes: ['fight-page'],
    },
    [focusedPlayerId, onOpenPlayerOverrides],
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
          disabled: isReplayMode,
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
        ...(seriesIndex === 0
          ? (() => {
              const markLineData: Record<string, unknown>[] = []
              if (targetDeathTimeMs !== null) {
                markLineData.push({
                  xAxis: targetDeathTimeMs,
                  lineStyle: {
                    color: deathMarkerColor,
                    type: 'solid' as const,
                    width: 2,
                  },
                  label: {
                    formatter: 'Target death',
                    color: deathMarkerColor,
                  },
                })
              }
              if (playheadMs !== null) {
                markLineData.push({
                  xAxis: playheadMs,
                  lineStyle: {
                    color: playheadColor,
                    type: 'solid' as const,
                    width: 2,
                  },
                  label: {
                    formatter: formatTimelineTime(playheadMs),
                    color: playheadColor,
                    position: 'start',
                  },
                })
              }
              return markLineData.length > 0
                ? {
                    markLine: {
                      silent: true,
                      symbol: ['none', 'none'],
                      data: markLineData,
                    },
                  }
                : {}
            })()
          : {}),
        data: item.data,
      }
    }) as EChartsOption['series'],
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
            selectionMethod: 'click',
          })
        }}
      />
      <div
        className="relative min-h-[240px] flex-1"
        data-testid="threat-chart-canvas-region"
      >
        <ReactEChartsCore
          className="absolute inset-0"
          echarts={echarts}
          ref={chartRef}
          notMerge
          opts={{ renderer }}
          option={option}
          style={{ height: '100%', width: '100%' }}
          onChartReady={() => {
            setIsChartReady(true)
          }}
          onEvents={{
            click: handleSeriesChartClick,
          }}
        />
        {isZoomed && !isReplayMode ? (
          <Button
            className="absolute right-3 top-3 z-10 bg-background/90 shadow-sm"
            size="sm"
            type="button"
            variant="outline"
            onClick={resetZoom}
          >
            Reset zoom
          </Button>
        ) : null}
      </div>
      {legendContainer
        ? createPortal(
            <ThreatChartLegend
              series={series}
              isActorVisible={isActorVisible}
              onActorClick={handleLegendItemClick}
              onActorFocus={onSeriesClick}
              onOpenPlayerOverrides={onOpenPlayerOverrides}
              actorIdsWithThreatOverrides={actorIdsWithThreatOverrides}
              pinnedPlayerIds={pinnedPlayerIds}
              onTogglePinnedPlayer={onTogglePinnedPlayer}
              showClearSelections={canClearIsolate}
              onClearSelections={handleClearSelections}
              showPets={showPets}
              onShowPetsChange={onShowPetsChange}
            />,
            legendContainer,
          )
        : null}
    </div>
  )
}
