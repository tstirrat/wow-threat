/**
 * Fight-level page with target filter and player-focused chart interactions.
 */
import { usePostHog } from 'posthog-js/react'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useHotkeys, useHotkeysContext } from 'react-hotkeys-hook'
import { useLocation, useParams } from 'react-router-dom'

import { ErrorBoundary } from '../components/error-boundary'
import { ErrorState } from '../components/error-state'
import {
  FightBarTarget,
  FightBarWarcraftLogsLink,
} from '../components/fight-bar-target'
import {
  FightSettingsButton,
  FightSettingsPanel,
} from '../components/fight-settings-panel'
import { FightWorkspace } from '../components/fight-workspace'
import {
  FightChartLoadingSkeleton,
  FightPageLoadingSkeleton,
  FightRosterLoadingSkeleton,
} from '../components/fight-workspace-skeletons'
import { PlaybackControls } from '../components/playback-controls'
import { PlayerInfoDrawer } from '../components/player-info-drawer'
import { PlayerSummaryTable } from '../components/player-summary-table'
import { PlayerThreatOverridesPanel } from '../components/player-threat-overrides-panel'
import { RosterToggleButton } from '../components/roster-toggle-button'
import { ThreatChart, type ThreatChartProps } from '../components/threat-chart'
import { useFightData } from '../hooks/use-fight-data'
import { useFightEvents } from '../hooks/use-fight-events'
import { useFightSettingsPanel } from '../hooks/use-fight-settings-panel'
import { usePlayerInfoDrawer } from '../hooks/use-player-info-drawer'
import { usePlayerThreatOverrides } from '../hooks/use-player-threat-overrides'
import { useReplayMode } from '../hooks/use-replay-mode'
import { useRosterVisibility } from '../hooks/use-roster-visibility'
import { useUserSettings } from '../hooks/use-user-settings'
import { parseBooleanQueryParam } from '../lib/query-params'
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
import {
  useBarExternalLink,
  useBarRosterToggle,
  useBarSettings,
  useBarTitleTrailing,
} from '../routes/app-shell-context'
import { useReportRouteContext } from '../routes/report-layout-context'
import type { BossDamageMode } from '../types/app'
import { useFightPageDerivedState } from './hooks/use-fight-page-derived-state'
import { useFightPageInteractions } from './hooks/use-fight-page-interactions'
import { useFightPageLoadTracking } from './hooks/use-fight-page-load-tracking'

/** Fight that already got its one-time default focus; module-level so a remount can't refocus after Esc. */
let lastAutoFocusedFightKey: string | null = null

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
    handlePlayheadCommit,
    handleSeriesClick,
    handleShowFixateBandsChange,
    handleShowRawThreatChange,
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
    chartPlayerIds: new Set(
      visibleSeries
        .filter((item) => item.actorType === 'Player')
        .map((item) => item.actorId),
    ),
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
  const [overridePanelActorId, setOverridePanelActorId] = useState<
    number | null
  >(null)
  // Settings and overrides share the right edge, so opening settings closes overrides.
  const settingsPanel = useFightSettingsPanel(() => {
    setOverridePanelActorId(null)
  })
  useBarSettings(
    <FightSettingsButton
      triggerRef={settingsPanel.triggerRef}
      onOpen={() => {
        settingsPanel.setOpen(true)
      }}
    />,
  )
  const [isChartReady, setIsChartReady] = useState(false)
  const replayMode = useReplayMode({
    committedPlayheadMs: queryState.state.playheadMs,
    onCommitState: handlePlayheadCommit,
    maxMs: fightDurationMs,
    playbackStartMs: queryState.state.startMs ?? 0,
    playbackEndMs: queryState.state.endMs ?? fightDurationMs,
    posthog,
  })

  const hasPlayhead = replayMode.effectivePlayheadMs !== null

  const [legendContainer, setLegendContainer] = useState<HTMLDivElement | null>(
    null,
  )

  // Only the roster's overrides button and the O hotkey open the panel; plain player clicks just focus.
  const handleOpenPlayerOverrides = useCallback(
    (actorId: number): void => {
      handleSeriesClick(actorId)
      const actor = fightData?.actors.find(
        (candidate) => candidate.id === actorId && candidate.type === 'Player',
      )
      if (actor) {
        settingsPanel.setOpen(false)
        setOverridePanelActorId(actorId)
      }
    },
    [fightData, handleSeriesClick, settingsPanel],
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

  const { closeRoster, isRosterVisible, toggleRoster } = useRosterVisibility()
  const {
    isPlayerInfoOpen,
    togglePlayerInfo,
    playerInfoHeight,
    setPlayerInfoHeight,
  } = usePlayerInfoDrawer()
  useBarRosterToggle(
    <RosterToggleButton
      isRosterVisible={isRosterVisible}
      onToggle={toggleRoster}
    />,
  )
  useBarTitleTrailing(
    fightData ? (
      <FightBarTarget
        selectedTarget={selectedTarget}
        targets={targetOptions}
        onTargetChange={handleTargetChange}
      />
    ) : null,
  )
  useBarExternalLink(
    fightData ? (
      <FightBarWarcraftLogsLink
        fightName={fightData.name}
        warcraftLogsUrl={buildFightRankingsUrl(reportHost, reportId, fightId)}
      />
    ) : null,
  )

  useEffect(() => {
    enableScope('fight-page')

    return () => {
      disableScope('fight-page')
    }
  }, [disableScope, enableScope])

  // Focus the top-threat player once per fight load when the URL has no focus;
  // after that, clearing focus (Esc) sticks.
  useEffect(() => {
    const fightKey = `${reportId}:${fightId}`
    if (visibleSeries.length === 0 || lastAutoFocusedFightKey === fightKey) {
      return
    }

    lastAutoFocusedFightKey = fightKey
    if (queryState.state.focusId !== null) {
      return
    }

    const selectedPlayers = new Set(queryState.state.players)
    const candidates = visibleSeries.filter(
      (item) =>
        item.actorType === 'Player' &&
        (selectedPlayers.size === 0 || selectedPlayers.has(item.actorId)),
    )
    const topPlayer = candidates.reduce<(typeof candidates)[number] | null>(
      (top, item) =>
        top === null || item.totalThreat > top.totalThreat ? item : top,
      null,
    )
    if (topPlayer) {
      queryState.setFocusId(topPlayer.actorId, { replace: true })
    }
  }, [fightId, queryState, reportId, visibleSeries])

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
    'space',
    (event) => {
      event.preventDefault()
      replayMode.togglePlayPause()
    },
    {
      description: 'Play / Pause (from T, or the start)',
      metadata: { group: 'Replay', order: 70, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [replayMode.togglePlayPause],
  )

  useHotkeys(
    'escape',
    (event) => {
      if (!hasPlayhead && queryState.state.focusId === null) return
      event.preventDefault()
      if (hasPlayhead) {
        replayMode.clearPlayhead()
      } else {
        queryState.setFocusId(null)
      }
    },
    {
      description: 'Clear T and stop playback, then clear focus',
      metadata: { group: 'Replay', order: 72, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [hasPlayhead, queryState, replayMode.clearPlayhead],
  )

  useHotkeys(
    'shift+period',
    (event) => {
      if (!hasPlayhead) return
      event.preventDefault()
      replayMode.increaseSpeed()
    },
    {
      description: 'Increase playback speed',
      metadata: { group: 'Replay', order: 73, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [hasPlayhead, replayMode.increaseSpeed],
  )

  useHotkeys(
    'shift+comma',
    (event) => {
      if (!hasPlayhead) return
      event.preventDefault()
      replayMode.decreaseSpeed()
    },
    {
      description: 'Decrease playback speed',
      metadata: { group: 'Replay', order: 74, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [hasPlayhead, replayMode.decreaseSpeed],
  )

  useHotkeys(
    'right',
    (event) => {
      if (!hasPlayhead) return
      event.preventDefault()
      replayMode.stepForward(event.shiftKey)
    },
    {
      description: 'Step playhead forward',
      metadata: { group: 'Replay', order: 75, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [hasPlayhead, replayMode.stepForward],
  )

  useHotkeys(
    'left',
    (event) => {
      if (!hasPlayhead) return
      event.preventDefault()
      replayMode.stepBackward(event.shiftKey)
    },
    {
      description: 'Step playhead backward',
      metadata: { group: 'Replay', order: 76, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [hasPlayhead, replayMode.stepBackward],
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
    onSeriesClick: handleSeriesClick,
    onOpenPlayerOverrides: handleOpenPlayerOverrides,
    onClearPlayerOverrides: playerThreatOverrides.resetActorOverrides,
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
    showRawThreat: userSettings.showRawThreat,
    onChartReadyChange: setIsChartReady,
    targetDeathTimeMs,
    playheadMs: replayMode.effectivePlayheadMs,
    onPlayheadChange: replayMode.setPlayheadMs,
    legendContainer,
  }

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
      <FightWorkspace
        label={`${fightData.name} fight workspace`}
        chart={
          <>
            {isUserSettingsLoading ? (
              <FightChartLoadingSkeleton loadingMessage="Loading fight settings" />
            ) : null}
            {isUserSettingsLoading ? null : selectedTarget === null ? (
              <p className="text-sm text-muted-foreground">
                No valid targets available for this fight.
              </p>
            ) : eventsQuery.isLoading ? (
              <FightChartLoadingSkeleton
                loadingMessage={
                  eventsQuery.loadingMessage || 'Loading fight events'
                }
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
          </>
        }
        isRosterVisible={isRosterVisible}
        onCloseRoster={closeRoster}
        rosterRef={setLegendContainer}
        roster={
          isUserSettingsLoading ||
          (selectedTarget !== null && eventsQuery.isLoading) ? (
            <FightRosterLoadingSkeleton />
          ) : null
        }
        transport={
          isUserSettingsLoading ? null : (
            <PlaybackControls
              isPlaying={replayMode.isPlaying}
              playbackSpeed={replayMode.playbackSpeed}
              hasPlayhead={hasPlayhead}
              playheadMs={replayMode.effectivePlayheadMs}
              onTogglePlayPause={replayMode.togglePlayPause}
              onIncreaseSpeed={replayMode.increaseSpeed}
              onDecreaseSpeed={replayMode.decreaseSpeed}
              onClearPlayhead={replayMode.clearPlayhead}
            />
          )
        }
        drawer={
          !isUserSettingsLoading && eventsData ? (
            <PlayerInfoDrawer
              isOpen={isPlayerInfoOpen && focusedPlayerSummary !== null}
              onToggle={
                focusedPlayerSummary ? togglePlayerInfo : () => undefined
              }
              bodyHeight={playerInfoHeight}
              onBodyHeightChange={setPlayerInfoHeight}
              onOpenOverrides={
                focusedPlayerActor
                  ? () => {
                      handleOpenPlayerOverrides(focusedPlayerActor.id)
                    }
                  : undefined
              }
              summary={focusedPlayerSummary}
              initialAuras={initialAuras}
            >
              <PlayerSummaryTable
                summary={focusedPlayerSummary}
                rows={focusedPlayerRows}
                initialAuras={initialAuras}
                wowhead={wowheadLinksConfig}
                warcraftLogsUrl={focusedPlayerWclUrl}
              />
            </PlayerInfoDrawer>
          ) : null
        }
      />
      <FightSettingsPanel
        bossDamageMode={bossDamageMode}
        inferThreatReduction={userSettings.inferThreatReduction}
        isOpen={settingsPanel.isOpen}
        showEnergizeEvents={userSettings.showEnergizeEvents}
        showFixateBands={userSettings.showFixateBands}
        showRawThreat={userSettings.showRawThreat}
        showPets={userSettings.showPets}
        threatConfigLabel={
          threatConfig
            ? `${threatConfig.displayName} v${threatConfig.version}`
            : 'No supported config'
        }
        triggerRef={settingsPanel.triggerRef}
        onBossDamageModeChange={handleBossDamageModeChange}
        onInferThreatReductionChange={handleInferThreatReductionChange}
        onOpenChange={settingsPanel.setOpen}
        onShowEnergizeEventsChange={handleShowEnergizeEventsChange}
        onShowFixateBandsChange={handleShowFixateBandsChange}
        onShowRawThreatChange={handleShowRawThreatChange}
        onShowPetsChange={handleShowPetsChange}
      />
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
