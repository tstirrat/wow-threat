/**
 * Fight-level page with target filter and player-focused chart interactions.
 */
import { ExternalLink } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useHotkeys, useHotkeysContext } from 'react-hotkeys-hook'
import { useLocation, useParams } from 'react-router-dom'

import { ErrorBoundary } from '../components/error-boundary'
import { ErrorState } from '../components/error-state'
import { PlaybackControls } from '../components/playback-controls'
import { PlayerSummaryTable } from '../components/player-summary-table'
import { PlayerThreatOverridesPanel } from '../components/player-threat-overrides-panel'
import { SectionCard } from '../components/section-card'
import { TargetSelector } from '../components/target-selector'
import { ThreatChart, type ThreatChartProps } from '../components/threat-chart'
import { ThreatChartControls } from '../components/threat-chart-controls'
import { ThreatMeter } from '../components/threat-meter'
import { Skeleton } from '../components/ui/skeleton'
import { useFightData } from '../hooks/use-fight-data'
import { useFightEvents } from '../hooks/use-fight-events'
import { usePlayerThreatOverrides } from '../hooks/use-player-threat-overrides'
import { useReplayMode } from '../hooks/use-replay-mode'
import { useUserSettings } from '../hooks/use-user-settings'
import { formatClockDuration } from '../lib/format'
import { parseBooleanQueryParam } from '../lib/query-params'
import { getThreatAtTime } from '../lib/threat-at-time'
import {
  readForcedThreatConfigParam,
  resolveCurrentThreatConfig,
} from '../lib/threat-config'
import {
  actorHasThreatOverrides,
  buildThreatOverrideOptions,
  serializeAuraOverridesByActor,
  serializeTalentRankOverridesByActor,
} from '../lib/threat-overrides'
import { buildCharacterUrl, buildFightRankingsUrl } from '../lib/wcl-url'
import { useReportRouteContext } from '../routes/report-layout-context'
import type { BossDamageMode } from '../types/app'
import { useFightPageDerivedState } from './hooks/use-fight-page-derived-state'
import { useFightPageInteractions } from './hooks/use-fight-page-interactions'
import { useFightPageLoadTracking } from './hooks/use-fight-page-load-tracking'

const FightPageLoadingSkeleton: FC = () => {
  return (
    <section aria-label="Loading fight data" aria-live="polite" role="status">
      <SectionCard
        title={<Skeleton className="h-6 w-40" />}
        headerRight={
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-7 w-40" />
          </div>
        }
      >
        <div className="space-y-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-[560px] w-full" />
        </div>
      </SectionCard>
    </section>
  )
}

const FightChartLoadingSkeleton: FC<{
  loadingMessage?: string
  showControlsSkeleton?: boolean
}> = ({
  loadingMessage = 'Loading fight events',
  showControlsSkeleton = true,
}) => {
  return (
    <section
      aria-label="Loading fight events chart"
      aria-live="polite"
      role="status"
    >
      <div className="space-y-3">
        {showControlsSkeleton ? (
          <div
            className="flex flex-wrap items-center gap-2"
            data-testid="fight-chart-controls-skeleton"
          >
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-52" />
          </div>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="relative h-[560px] w-full">
            <Skeleton
              className="h-full w-full"
              data-testid="fight-chart-skeleton"
            />
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {loadingMessage}
            </p>
          </div>
          <Skeleton
            className="h-[560px] w-full"
            data-testid="fight-legend-skeleton"
          />
        </div>
      </div>
    </section>
  )
}

export const FightPage: FC = () => {
  const params = useParams<{ fightId: string }>()
  const location = useLocation()
  const { reportData, reportHost, reportId } = useReportRouteContext()
  const posthog = usePostHog()
  const fightId = Number.parseInt(params.fightId ?? '', 10)
  const searchParams = new URLSearchParams(location.search)
  const chartRenderer =
    searchParams.get('renderer') === 'svg' ? 'svg' : 'canvas'
  const forceFreshEvents =
    parseBooleanQueryParam(searchParams.get('fresh')) ?? false
  const forceLegacyWorkerMode = searchParams.get('eventsMode') === 'legacy'
  const forcedThreatConfig = readForcedThreatConfigParam(
    searchParams.get('config'),
  )
  const {
    settings: userSettings,
    isLoading: isUserSettingsLoading,
    updateSettings: updateUserSettings,
  } = useUserSettings()

  const threatConfig = useMemo(
    () => resolveCurrentThreatConfig(reportData, forcedThreatConfig.configId),
    [forcedThreatConfig.configId, reportData],
  )
  const fightQuery = useFightData(reportId, fightId)
  const fightData = fightQuery.data ?? null
  const playerThreatOverrides = usePlayerThreatOverrides({ fightId, reportId })
  const auraOverridesByActor = useMemo(
    () => serializeAuraOverridesByActor(playerThreatOverrides.overridesByActor),
    [playerThreatOverrides.overridesByActor],
  )
  const talentRankOverridesByActor = useMemo(
    () =>
      serializeTalentRankOverridesByActor(
        playerThreatOverrides.overridesByActor,
      ),
    [playerThreatOverrides.overridesByActor],
  )
  const eventsQueryEnabled = !isUserSettingsLoading
  const eventsQuery = useFightEvents(
    reportId,
    fightId,
    userSettings.inferThreatReduction,
    eventsQueryEnabled,
    forceFreshEvents,
    forceLegacyWorkerMode,
    forcedThreatConfig.configId,
    auraOverridesByActor,
    talentRankOverridesByActor,
    playerThreatOverrides.overrideScope,
  )
  const eventsData = eventsQuery.data ?? null

  const {
    allSeries,
    focusedPlayerRows,
    focusedPlayerSummary,
    initialAuras,
    queryState,
    selectedTarget,
    targetDeathTimeMs,
    targetOptions,
    validPlayerIds,
    visibleSeries,
    wowheadLinksConfig,
  } = useFightPageDerivedState({
    eventsData,
    fightData,
    reportData,
    showPets: userSettings.showPets,
    threatConfig,
  })
  const fightDurationMs = fightData
    ? Math.max(fightData.endTime - fightData.startTime, 0)
    : 0
  const {
    handleClearSelections,
    handleFocusAndAddPlayer,
    handleFocusAndIsolatePlayer,
    handleToggleFocusedPlayerIsolation,
    handleBossDamageModeChange,
    handleInferThreatReductionChange,
    handleReplayStateChange,
    handleSeriesClick,
    handleShowFixateBandsChange,
    handleShowEnergizeEventsChange,
    handleShowPetsChange,
    handleTogglePinnedPlayer,
    handleTargetChange,
    handleVisiblePlayerIdsChange,
    handleWindowChange,
  } = useFightPageInteractions({
    queryState,
    updateUserSettings,
    validPlayerIds,
    fightId,
    reportId,
    posthog,
  })
  const bossDamageMode: BossDamageMode = userSettings.showBossMelee
    ? userSettings.showAllBossDamageEvents
      ? 'all'
      : 'melee'
    : 'off'
  const { disableScope, enableScope } = useHotkeysContext()
  const [isChartReady, setIsChartReady] = useState(false)
  const [registeredResetZoom, setRegisteredResetZoom] = useState<
    (() => void) | null
  >(null)

  const handleRegisterResetZoom = useCallback(
    (resetZoom: (() => void) | null): void => {
      setRegisteredResetZoom(() => resetZoom)
    },
    [],
  )

  const replayMode = useReplayMode({
    committedPlayheadMs: queryState.state.playheadMs,
    committedReplay: queryState.state.replay,
    onCommitState: handleReplayStateChange,
    resetZoom: () => {
      registeredResetZoom?.()
    },
    maxMs: fightDurationMs,
    posthog,
  })

  const threatAtPlayhead =
    replayMode.effectivePlayheadMs !== null
      ? getThreatAtTime(allSeries, replayMode.effectivePlayheadMs)
      : null

  const [isThreatMeterExpanded, setIsThreatMeterExpanded] = useState(false)
  const [overridePanelActorId, setOverridePanelActorId] = useState<
    number | null
  >(null)

  const handlePlayerClick = useCallback(
    (actorId: number): void => {
      handleSeriesClick(actorId)
      const actor = fightData?.actors.find(
        (candidate) => candidate.id === actorId && candidate.type === 'Player',
      )
      if (actor) {
        setOverridePanelActorId(actorId)
      }
    },
    [fightData, handleSeriesClick],
  )

  const overridePanelActor =
    overridePanelActorId === null
      ? null
      : (fightData?.actors.find(
          (actor) =>
            actor.id === overridePanelActorId && actor.type === 'Player',
        ) ?? null)
  const overridePanelOptions = buildThreatOverrideOptions(
    threatConfig,
    overridePanelActor?.subType,
  )
  const overridePanelActorColor =
    allSeries.find((series) => series.actorId === overridePanelActorId)
      ?.color ?? 'currentColor'
  const actorIdsWithThreatOverrides = useMemo(() => {
    return new Set(
      Object.entries(playerThreatOverrides.overridesByActor)
        .filter(([, overrides]) => actorHasThreatOverrides(overrides))
        .map(([actorId]) => Number(actorId)),
    )
  }, [playerThreatOverrides.overridesByActor])

  useFightPageLoadTracking({
    fightId,
    reportId,
    fightData,
    eventsQueryError: eventsQuery.error,
    isChartReady,
    visibleSeriesCount: visibleSeries.length,
    posthog,
  })

  useEffect(() => {
    enableScope('fight-page')

    return () => {
      disableScope('fight-page')
    }
  }, [disableScope, enableScope])

  useHotkeys(
    'b',
    (event) => {
      event.preventDefault()
      const nextBossDamageMode: BossDamageMode =
        bossDamageMode === 'off'
          ? 'melee'
          : bossDamageMode === 'melee'
            ? 'all'
            : 'off'
      handleBossDamageModeChange(nextBossDamageMode)
    },
    {
      description: 'Cycle boss damage markers',
      metadata: {
        order: 10,
        showInFightOverlay: true,
      },
      scopes: ['fight-page'],
    },
    [bossDamageMode, handleBossDamageModeChange],
  )

  useHotkeys(
    'p',
    (event) => {
      event.preventDefault()
      handleShowPetsChange(!userSettings.showPets)
    },
    {
      description: 'Toggle show pets',
      metadata: {
        order: 20,
        showInFightOverlay: true,
      },
      scopes: ['fight-page'],
    },
    [handleShowPetsChange, userSettings.showPets],
  )

  useHotkeys(
    'e',
    (event) => {
      event.preventDefault()
      handleShowEnergizeEventsChange(!userSettings.showEnergizeEvents)
    },
    {
      description: 'Toggle show energize events',
      metadata: {
        order: 30,
        showInFightOverlay: true,
      },
      scopes: ['fight-page'],
    },
    [handleShowEnergizeEventsChange, userSettings.showEnergizeEvents],
  )

  useHotkeys(
    'r',
    (event) => {
      event.preventDefault()
      replayMode.toggleReplayMode()
    },
    {
      description: 'Toggle replay mode',
      metadata: { group: 'Replay', order: 70, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [replayMode.toggleReplayMode],
  )

  useHotkeys(
    'space',
    (event) => {
      if (!replayMode.isReplayMode) return
      event.preventDefault()
      replayMode.togglePlayPause()
    },
    {
      description: 'Play / Pause',
      metadata: { group: 'Replay', order: 71, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [replayMode.isReplayMode, replayMode.togglePlayPause],
  )

  useHotkeys(
    'escape',
    (event) => {
      if (!replayMode.isReplayMode) return
      event.preventDefault()
      replayMode.exitReplayMode()
    },
    {
      description: 'Exit replay mode',
      metadata: { group: 'Replay', order: 72, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [replayMode.isReplayMode, replayMode.exitReplayMode],
  )

  useHotkeys(
    'shift+period',
    (event) => {
      if (!replayMode.isReplayMode) return
      event.preventDefault()
      replayMode.increaseSpeed()
    },
    {
      description: 'Increase playback speed',
      metadata: { group: 'Replay', order: 73, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [replayMode.isReplayMode, replayMode.increaseSpeed],
  )

  useHotkeys(
    'shift+comma',
    (event) => {
      if (!replayMode.isReplayMode) return
      event.preventDefault()
      replayMode.decreaseSpeed()
    },
    {
      description: 'Decrease playback speed',
      metadata: { group: 'Replay', order: 74, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [replayMode.isReplayMode, replayMode.decreaseSpeed],
  )

  useHotkeys(
    'right',
    (event) => {
      if (!replayMode.isReplayMode) return
      event.preventDefault()
      replayMode.stepForward(event.shiftKey)
    },
    {
      description: 'Step playhead forward',
      metadata: { group: 'Replay', order: 75, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [replayMode.isReplayMode, replayMode.stepForward],
  )

  useHotkeys(
    'left',
    (event) => {
      if (!replayMode.isReplayMode) return
      event.preventDefault()
      replayMode.stepBackward(event.shiftKey)
    },
    {
      description: 'Step playhead backward',
      metadata: { group: 'Replay', order: 76, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [replayMode.isReplayMode, replayMode.stepBackward],
  )

  if (!reportId || Number.isNaN(fightId)) {
    return (
      <>
        <title>Fight | WOW Threat</title>
        <ErrorState
          message="Fight route requires both reportId and fightId."
          title="Invalid fight route"
        />
      </>
    )
  }

  if (fightQuery.isLoading) {
    return (
      <>
        <title>{`Fight ${fightId} | WOW Threat`}</title>
        <FightPageLoadingSkeleton />
      </>
    )
  }

  if (fightQuery.error || !fightData) {
    return (
      <>
        <title>{`Fight ${fightId} | WOW Threat`}</title>
        <ErrorState
          message={fightQuery.error?.message ?? 'Fight metadata unavailable.'}
          title="Unable to load fight"
        />
      </>
    )
  }

  if (eventsQuery.error) {
    return (
      <>
        <title>{`${fightData.name} | WOW Threat`}</title>
        <ErrorState
          message={eventsQuery.error?.message ?? 'Fight events unavailable.'}
          title="Unable to load threat events"
        />
      </>
    )
  }

  if (
    !isUserSettingsLoading &&
    eventsQueryEnabled &&
    !eventsQuery.isLoading &&
    !eventsData
  ) {
    return (
      <>
        <title>{`${fightData.name} | WOW Threat`}</title>
        <ErrorState
          message="Fight events unavailable."
          title="Unable to load threat events"
        />
      </>
    )
  }

  const chartProps: ThreatChartProps = {
    renderer: chartRenderer,
    series: visibleSeries,
    fightId,
    reportId,
    zoomToggleContextKey: `${reportId}:${fightId}:${selectedTarget?.id ?? 'none'}:${selectedTarget?.instance ?? 'none'}`,
    focusedActorId: queryState.state.focusId,
    selectedPlayerIds: queryState.state.players,
    pinnedPlayerIds: queryState.state.pinnedPlayers,
    onVisiblePlayerIdsChange: handleVisiblePlayerIdsChange,
    onClearSelections: handleClearSelections,
    windowEndMs: queryState.state.endMs,
    windowStartMs: queryState.state.startMs,
    onSeriesClick: handlePlayerClick,
    onOpenPlayerOverrides: handlePlayerClick,
    actorIdsWithThreatOverrides,
    onFocusAndAddPlayer: handleFocusAndAddPlayer,
    onFocusAndIsolatePlayer: handleFocusAndIsolatePlayer,
    onToggleFocusedPlayerIsolation: handleToggleFocusedPlayerIsolation,
    onTogglePinnedPlayer: handleTogglePinnedPlayer,
    onWindowChange: handleWindowChange,
    showPets: userSettings.showPets,
    onShowPetsChange: handleShowPetsChange,
    showEnergizeEvents: userSettings.showEnergizeEvents,
    bossDamageMode,
    showFixateBands: userSettings.showFixateBands,
    onChartReadyChange: setIsChartReady,
    onRegisterResetZoom: handleRegisterResetZoom,
    targetDeathTimeMs,
    isReplayMode: replayMode.isReplayMode,
    playheadMs: replayMode.effectivePlayheadMs,
    onPlayheadChange: replayMode.setPlayheadMs,
    rightPanel:
      replayMode.isReplayMode && threatAtPlayhead ? (
        <ThreatMeter
          entries={threatAtPlayhead}
          focusedActorId={queryState.state.focusId}
          selectedPlayerIds={queryState.state.players}
          playheadMs={replayMode.effectivePlayheadMs ?? 0}
          isExpanded={isThreatMeterExpanded}
          onExpandedChange={setIsThreatMeterExpanded}
        />
      ) : undefined,
  }

  const fightTimelineTitle = (
    <div className="flex flex-wrap items-center gap-2">
      <span>{fightData.name}</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">
        {formatClockDuration(fightDurationMs)}
      </span>
      <span className="text-muted-foreground">|</span>
      <a
        aria-label={`Open ${fightData.name} on Warcraft Logs`}
        className="inline-flex items-center gap-1 leading-none hover:opacity-80"
        href={buildFightRankingsUrl(reportHost, reportId, fightId)}
        rel="noreferrer"
        target="_blank"
        title={`Open ${fightData.name} on Warcraft Logs`}
      >
        <span className="text-[10px] font-medium tracking-wide">WCL</span>
        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
      </a>
    </div>
  )
  const focusedPlayerActor = focusedPlayerSummary
    ? (fightData.actors.find(
        (actor) =>
          actor.id === focusedPlayerSummary.actorId && actor.type === 'Player',
      ) ?? null)
    : null
  const focusedPlayerWclUrl =
    focusedPlayerActor &&
    reportData.guild?.serverRegion &&
    reportData.guild.serverSlug
      ? buildCharacterUrl(reportHost, {
          characterName: focusedPlayerActor.name,
          region: reportData.guild.serverRegion,
          serverSlug: reportData.guild.serverSlug,
        })
      : null
  const reportTitle = reportData.title.trim() || reportId
  const pageTitle = `${fightData.name} | ${reportTitle} | WOW Threat`

  return (
    <>
      <title>{pageTitle}</title>
      <div className="space-y-5">
        <SectionCard
          title={fightTimelineTitle}
          headerRight={
            selectedTarget ? (
              <div>
                <TargetSelector
                  targets={targetOptions}
                  selectedTarget={selectedTarget}
                  onChange={handleTargetChange}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No valid targets available.
              </p>
            )
          }
        >
          {isUserSettingsLoading ? (
            <FightChartLoadingSkeleton loadingMessage="Loading fight settings" />
          ) : (
            <>
              <ThreatChartControls
                onResetZoom={() => {
                  registeredResetZoom?.()
                }}
                isResetZoomDisabled={
                  !isChartReady ||
                  registeredResetZoom === null ||
                  replayMode.isReplayMode
                }
                showFixateBands={userSettings.showFixateBands}
                onShowFixateBandsChange={handleShowFixateBandsChange}
                showEnergizeEvents={userSettings.showEnergizeEvents}
                onShowEnergizeEventsChange={handleShowEnergizeEventsChange}
                bossDamageMode={bossDamageMode}
                onBossDamageModeChange={handleBossDamageModeChange}
                inferThreatReduction={userSettings.inferThreatReduction}
                onInferThreatReductionChange={handleInferThreatReductionChange}
              />
              <PlaybackControls
                isPlaying={replayMode.isPlaying}
                isReplayMode={replayMode.isReplayMode}
                playbackSpeed={replayMode.playbackSpeed}
                hasPlayhead={replayMode.effectivePlayheadMs !== null}
                onTogglePlayPause={replayMode.togglePlayPause}
                onIncreaseSpeed={replayMode.increaseSpeed}
                onDecreaseSpeed={replayMode.decreaseSpeed}
                onToggleReplayMode={replayMode.toggleReplayMode}
                onClearPlayhead={replayMode.clearPlayhead}
              />
            </>
          )}

          {isUserSettingsLoading ? null : selectedTarget === null ? (
            <p className="text-sm text-muted-foreground">
              No valid targets available for this fight.
            </p>
          ) : eventsQuery.isLoading ? (
            <FightChartLoadingSkeleton
              loadingMessage={
                eventsQuery.loadingMessage || 'Loading fight events'
              }
              showControlsSkeleton={false}
            />
          ) : chartProps.series.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No threat points are available for this target.
            </p>
          ) : (
            <ErrorBoundary>
              <ThreatChart {...chartProps} />
            </ErrorBoundary>
          )}
        </SectionCard>

        {!isUserSettingsLoading && eventsData ? (
          <SectionCard
            title="Focused player summary"
            subtitle="Totals and ability TPS are calculated from the currently visible chart window."
          >
            <PlayerSummaryTable
              summary={focusedPlayerSummary}
              rows={focusedPlayerRows}
              initialAuras={initialAuras}
              wowhead={wowheadLinksConfig}
              warcraftLogsUrl={focusedPlayerWclUrl}
            />
          </SectionCard>
        ) : null}
      </div>
      {overridePanelActor ? (
        <PlayerThreatOverridesPanel
          actor={overridePanelActor}
          actorColor={overridePanelActorColor}
          actorOverrides={
            playerThreatOverrides.overridesByActor[
              String(overridePanelActor.id)
            ]
          }
          isRecalculating={eventsQuery.isFetching}
          options={overridePanelOptions}
          onAuraOverrideChange={(option, state) => {
            playerThreatOverrides.setAuraOverride(
              overridePanelActor.id,
              option,
              state,
            )
          }}
          onClose={() => {
            setOverridePanelActorId(null)
          }}
          onReset={() => {
            playerThreatOverrides.resetActorOverrides(overridePanelActor.id)
          }}
          onTalentRankOverrideChange={(option, rank) => {
            playerThreatOverrides.setTalentRankOverride(
              overridePanelActor.id,
              option.talentEntryId,
              rank,
            )
          }}
        />
      ) : null}
    </>
  )
}
