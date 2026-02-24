/**
 * Fight-level page with target filter and player-focused chart interactions.
 */
import { ExternalLink } from 'lucide-react'
import { type FC, useCallback, useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import { ErrorState } from '../components/error-state'
import { PlayerSummaryTable } from '../components/player-summary-table'
import { SectionCard } from '../components/section-card'
import { TargetSelector } from '../components/target-selector'
import { ThreatChart } from '../components/threat-chart'
import { useFightData } from '../hooks/use-fight-data'
import { useFightEvents } from '../hooks/use-fight-events'
import { useFightQueryState } from '../hooks/use-fight-query-state'
import { useUserSettings } from '../hooks/use-user-settings'
import { buildVisibleSeriesForLegend } from '../lib/fight-page-series'
import { formatClockDuration } from '../lib/format'
import {
  buildFightTargetOptions,
  buildFocusedPlayerSummary,
  buildFocusedPlayerThreatRows,
  buildInitialAurasDisplay,
  buildThreatSeries,
  resolveSeriesWindowBounds,
  selectDefaultTarget,
} from '../lib/threat-aggregation'
import { resolveCurrentThreatConfig } from '../lib/threat-config'
import { buildFightRankingsUrl } from '../lib/wcl-url'
import { useReportRouteContext } from '../routes/report-layout-context'
import type { WowheadLinksConfig } from '../types/app'

const defaultWowheadLinksConfig: WowheadLinksConfig = {
  domain: 'classic',
}

function areEqualIdLists(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((id, index) => id === right[index])
}

const FightPageLoadingSkeleton: FC = () => {
  return (
    <section aria-label="Loading fight data" aria-live="polite" role="status">
      <SectionCard
        title={
          <div className="h-6 w-40 rounded-md bg-muted/70 motion-safe:animate-pulse" />
        }
        headerRight={
          <div className="flex items-center gap-3">
            <div className="h-5 w-20 rounded-md bg-muted/60 motion-safe:animate-pulse" />
            <div className="h-7 w-40 rounded-md bg-muted/60 motion-safe:animate-pulse" />
          </div>
        }
      >
        <div className="mt-4 space-y-3">
          <div className="h-8 w-24 rounded-md bg-muted/60 motion-safe:animate-pulse" />
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
            <div
              className="h-[560px] rounded-md border border-border bg-muted/40 motion-safe:animate-pulse"
              data-testid="fight-chart-skeleton"
            />
            <div
              className="h-[560px] rounded-md border border-border p-4"
              data-testid="fight-legend-skeleton"
            >
              <div className="h-6 w-20 rounded-md bg-muted/70 motion-safe:animate-pulse" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 14 }, (_, index) => (
                  <div
                    key={index}
                    className="h-4 rounded-md bg-muted/60 motion-safe:animate-pulse"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </section>
  )
}

export const FightPage: FC = () => {
  const params = useParams<{ fightId: string }>()
  const location = useLocation()
  const { reportData, reportHost, reportId } = useReportRouteContext()
  const fightId = Number.parseInt(params.fightId ?? '', 10)
  const chartRenderer =
    new URLSearchParams(location.search).get('renderer') === 'svg'
      ? 'svg'
      : 'canvas'
  const {
    settings: userSettings,
    isLoading: isUserSettingsLoading,
    updateSettings: updateUserSettings,
  } = useUserSettings()

  const threatConfig = useMemo(
    () => resolveCurrentThreatConfig(reportData),
    [reportData],
  )
  const fightQuery = useFightData(reportId, fightId)
  const eventsQuery = useFightEvents(
    reportId,
    fightId,
    threatConfig?.version ?? null,
    userSettings.inferThreatReduction,
    !isUserSettingsLoading,
  )
  const fightData = fightQuery.data ?? null
  const eventsData = eventsQuery.data ?? null

  const validPlayerIds = useMemo(
    () =>
      new Set(
        (fightData?.actors ?? [])
          .filter((actor) => actor.type === 'Player')
          .map((actor) => actor.id),
      ),
    [fightData?.actors],
  )
  const validActorIds = useMemo(
    () => new Set((fightData?.actors ?? []).map((actor) => actor.id)),
    [fightData?.actors],
  )
  const targetOptions = useMemo(
    () =>
      buildFightTargetOptions({
        enemies: fightData?.enemies ?? [],
        events: eventsData?.events ?? [],
      }),
    [eventsData?.events, fightData?.enemies],
  )
  const validTargetKeys = useMemo(
    () => new Set(targetOptions.map((target) => target.key)),
    [targetOptions],
  )

  const durationMs = useMemo(() => {
    if (!fightData || !eventsData) {
      return 0
    }

    const fightDuration = fightData.endTime - fightData.startTime
    return fightDuration > 0 ? fightDuration : eventsData.summary.duration
  }, [eventsData, fightData])

  const queryState = useFightQueryState({
    validPlayerIds,
    validActorIds,
    validTargetKeys,
    maxDurationMs: durationMs,
  })

  const defaultTarget = useMemo(
    () => selectDefaultTarget(eventsData?.events ?? [], validTargetKeys),
    [eventsData?.events, validTargetKeys],
  )

  const selectedTarget = useMemo(() => {
    if (
      queryState.state.targetId !== null &&
      queryState.state.targetInstance !== null
    ) {
      return {
        id: queryState.state.targetId,
        instance: queryState.state.targetInstance,
      }
    }

    if (defaultTarget) {
      return defaultTarget
    }

    const firstTarget = targetOptions[0]
    if (!firstTarget) {
      return null
    }

    return {
      id: firstTarget.id,
      instance: firstTarget.instance,
    }
  }, [
    defaultTarget,
    queryState.state.targetId,
    queryState.state.targetInstance,
    targetOptions,
  ])

  const allSeries = useMemo(() => {
    if (!selectedTarget || !eventsData || !fightData || !reportData) {
      return []
    }

    return buildThreatSeries({
      events: eventsData.events,
      actors: fightData.actors,
      abilities: reportData.abilities,
      fightStartTime: fightData.startTime,
      fightEndTime: fightData.endTime,
      target: selectedTarget,
    })
  }, [eventsData, fightData, reportData, selectedTarget])

  const visibleSeries = useMemo(
    () => buildVisibleSeriesForLegend(allSeries, userSettings.showPets),
    [allSeries, userSettings.showPets],
  )

  const windowBounds = useMemo(
    () => resolveSeriesWindowBounds(visibleSeries),
    [visibleSeries],
  )
  const selectedWindowStartMs = queryState.state.startMs ?? windowBounds.min
  const selectedWindowEndMs = queryState.state.endMs ?? windowBounds.max

  const focusedPlayerId = useMemo(() => {
    const candidatePlayerId =
      queryState.state.focusId ?? queryState.state.players[0] ?? null
    if (candidatePlayerId === null) {
      return null
    }

    const hasVisibleSeries = visibleSeries.some(
      (series) => series.actorId === candidatePlayerId,
    )
    return hasVisibleSeries ? candidatePlayerId : null
  }, [queryState.state.focusId, queryState.state.players, visibleSeries])

  const focusedPlayerSummary = useMemo(() => {
    if (selectedTarget === null) {
      return null
    }

    return buildFocusedPlayerSummary({
      events: eventsData?.events ?? [],
      actors: fightData?.actors ?? [],
      abilities: reportData.abilities,
      threatConfig,
      fightStartTime: fightData?.startTime ?? 0,
      target: selectedTarget,
      focusedPlayerId,
      windowStartMs: selectedWindowStartMs,
      windowEndMs: selectedWindowEndMs,
    })
  }, [
    eventsData?.events,
    fightData?.actors,
    fightData?.startTime,
    focusedPlayerId,
    reportData.abilities,
    selectedTarget,
    selectedWindowEndMs,
    selectedWindowStartMs,
    threatConfig,
  ])

  const focusedPlayerRows = useMemo(() => {
    if (selectedTarget === null) {
      return []
    }

    return buildFocusedPlayerThreatRows({
      events: eventsData?.events ?? [],
      actors: fightData?.actors ?? [],
      abilities: reportData.abilities,
      fightStartTime: fightData?.startTime ?? 0,
      target: selectedTarget,
      focusedPlayerId,
      windowStartMs: selectedWindowStartMs,
      windowEndMs: selectedWindowEndMs,
    })
  }, [
    eventsData?.events,
    fightData?.actors,
    fightData?.startTime,
    focusedPlayerId,
    reportData.abilities,
    selectedTarget,
    selectedWindowEndMs,
    selectedWindowStartMs,
  ])

  const initialAuras = useMemo(
    () =>
      buildInitialAurasDisplay(
        eventsData?.events ?? [],
        focusedPlayerId,
        threatConfig,
        {
          initialAurasByActor: eventsData?.initialAurasByActor,
          abilities: reportData.abilities,
        },
      ),
    [
      eventsData?.events,
      eventsData?.initialAurasByActor,
      focusedPlayerId,
      reportData.abilities,
      threatConfig,
    ],
  )
  const wowheadLinksConfig = threatConfig?.wowhead ?? defaultWowheadLinksConfig
  const handleTargetChange = useCallback(
    (target: { id: number; instance: number }) => {
      queryState.setTarget(target)
    },
    [queryState],
  )

  const handleSeriesClick = useCallback(
    (playerId: number) => {
      queryState.setFocusId(playerId)
    },
    [queryState],
  )
  const handleVisiblePlayerIdsChange = useCallback(
    (visiblePlayerIds: number[]) => {
      const allPlayerIds = [...validPlayerIds].sort((a, b) => a - b)
      const nextPlayers = areEqualIdLists(visiblePlayerIds, allPlayerIds)
        ? []
        : visiblePlayerIds

      const currentPlayers = [...queryState.state.players].sort((a, b) => a - b)
      if (areEqualIdLists(currentPlayers, nextPlayers)) {
        return
      }

      queryState.setPlayers(nextPlayers)
    },
    [queryState, validPlayerIds],
  )

  const handleWindowChange = useCallback(
    (startMs: number | null, endMs: number | null) => {
      queryState.setWindow(startMs, endMs)
    },
    [queryState],
  )
  const handleShowPetsChange = useCallback(
    (showPets: boolean) => {
      void updateUserSettings({
        showPets,
      })
    },
    [updateUserSettings],
  )
  const handleShowEnergizeEventsChange = useCallback(
    (showEnergizeEvents: boolean) => {
      void updateUserSettings({
        showEnergizeEvents,
      })
    },
    [updateUserSettings],
  )
  const handleInferThreatReductionChange = useCallback(
    (inferThreatReduction: boolean) => {
      void updateUserSettings({
        inferThreatReduction,
      })
    },
    [updateUserSettings],
  )

  if (!reportId || Number.isNaN(fightId)) {
    return (
      <ErrorState
        message="Fight route requires both reportId and fightId."
        title="Invalid fight route"
      />
    )
  }

  if (fightQuery.isLoading || isUserSettingsLoading || eventsQuery.isLoading) {
    return <FightPageLoadingSkeleton />
  }

  if (fightQuery.error || !fightData) {
    return (
      <ErrorState
        message={fightQuery.error?.message ?? 'Fight metadata unavailable.'}
        title="Unable to load fight"
      />
    )
  }

  if (eventsQuery.error || !eventsData) {
    return (
      <ErrorState
        message={eventsQuery.error?.message ?? 'Fight events unavailable.'}
        title="Unable to load threat events"
      />
    )
  }

  const fightTimelineTitle = (
    <div className="flex flex-wrap items-center gap-2">
      <span>{fightData.name}</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">
        {formatClockDuration(durationMs)}
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

  return (
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
        {selectedTarget === null ? (
          <p className="text-sm text-muted-foreground">
            No valid targets available for this fight.
          </p>
        ) : visibleSeries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No threat points are available for this target.
          </p>
        ) : (
          <ThreatChart
            renderer={chartRenderer}
            series={visibleSeries}
            selectedPlayerIds={queryState.state.players}
            onVisiblePlayerIdsChange={handleVisiblePlayerIdsChange}
            windowEndMs={queryState.state.endMs}
            windowStartMs={queryState.state.startMs}
            onSeriesClick={handleSeriesClick}
            onWindowChange={handleWindowChange}
            showPets={userSettings.showPets}
            onShowPetsChange={handleShowPetsChange}
            showEnergizeEvents={userSettings.showEnergizeEvents}
            onShowEnergizeEventsChange={handleShowEnergizeEventsChange}
            inferThreatReduction={userSettings.inferThreatReduction}
            onInferThreatReductionChange={handleInferThreatReductionChange}
          />
        )}
      </SectionCard>

      <SectionCard
        title="Focused player summary"
        subtitle="Totals and ability TPS are calculated from the currently visible chart window."
      >
        <PlayerSummaryTable
          summary={focusedPlayerSummary}
          rows={focusedPlayerRows}
          initialAuras={initialAuras}
          wowhead={wowheadLinksConfig}
        />
      </SectionCard>
    </div>
  )
}
