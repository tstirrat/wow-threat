/**
 * Fight-level page with target filter and player-focused chart interactions.
 */
import { useCallback, useEffect, useMemo, useState, type FC } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { ErrorState } from '../components/error-state'
import { LoadingState } from '../components/loading-state'
import { PlayerSummaryTable } from '../components/player-summary-table'
import { SectionCard } from '../components/section-card'
import { TargetSelector } from '../components/target-selector'
import { ThreatChart } from '../components/threat-chart'
import {
  buildFocusedPlayerSummary,
  buildFocusedPlayerThreatRows,
  buildThreatSeries,
  resolveSeriesWindowBounds,
  selectDefaultTargetId,
} from '../lib/threat-aggregation'
import { buildFightRankingsUrl, buildReportUrl } from '../lib/wcl-url'
import { useFightData } from '../hooks/use-fight-data'
import { useFightEvents } from '../hooks/use-fight-events'
import { useFightQueryState } from '../hooks/use-fight-query-state'
import { useReportData } from '../hooks/use-report-data'
import { useReportHost } from '../hooks/use-report-host'
import { useRecentReports } from '../hooks/use-recent-reports'
import type { WarcraftLogsHost } from '../types/app'

interface LocationState {
  host?: WarcraftLogsHost
}

export const FightPage: FC = () => {
  const params = useParams<{ reportId: string; fightId: string }>()
  const location = useLocation()
  const locationState = location.state as LocationState | null

  const reportId = params.reportId ?? ''
  const fightId = Number.parseInt(params.fightId ?? '', 10)

  const { recentReports, addRecentReport } = useRecentReports()
  const reportHost = useReportHost(reportId, recentReports)

  const reportQuery = useReportData(reportId)
  const fightQuery = useFightData(reportId, fightId)
  const eventsQuery = useFightEvents(reportId, fightId)

  useEffect(() => {
    if (!reportQuery.data) {
      return
    }

    addRecentReport({
      reportId,
      title: reportQuery.data.title,
      sourceHost: locationState?.host ?? reportHost,
      lastOpenedAt: Date.now(),
    })
  }, [addRecentReport, locationState?.host, reportHost, reportId, reportQuery.data])

  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)

  const reportData = reportQuery.data ?? null
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
  const validTargetIds = useMemo(
    () => new Set((fightData?.enemies ?? []).map((enemy) => enemy.id)),
    [fightData?.enemies],
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
    validTargetIds,
    maxDurationMs: durationMs,
  })

  const defaultTargetId = useMemo(
    () => selectDefaultTargetId(eventsData?.events ?? [], validTargetIds),
    [eventsData?.events, validTargetIds],
  )

  const selectedTargetId = useMemo(
    () => queryState.state.targetId ?? defaultTargetId ?? fightData?.enemies[0]?.id ?? null,
    [defaultTargetId, fightData?.enemies, queryState.state.targetId],
  )

  const allSeries = useMemo(() => {
    if (!selectedTargetId || !eventsData || !fightData || !reportData) {
      return []
    }

    return buildThreatSeries({
      events: eventsData.events,
      actors: fightData.actors,
      abilities: reportData.abilities,
      fightStartTime: fightData.startTime,
      fightEndTime: fightData.endTime,
      targetId: selectedTargetId,
    })
  }, [
    eventsData,
    fightData,
    reportData,
    selectedTargetId,
  ])

  const visibleSeries = useMemo(
    () =>
      allSeries
        .filter((series) => series.actorType === 'Player')
        .sort((a, b) => b.totalThreat - a.totalThreat),
    [allSeries],
  )

  const windowBounds = useMemo(
    () => resolveSeriesWindowBounds(visibleSeries),
    [visibleSeries],
  )
  const selectedWindowStartMs = queryState.state.startMs ?? windowBounds.min
  const selectedWindowEndMs = queryState.state.endMs ?? windowBounds.max

  const focusedPlayerId = useMemo(() => {
    const candidatePlayerId = selectedPlayerId ?? queryState.state.players[0] ?? null
    if (candidatePlayerId === null) {
      return null
    }

    const hasVisibleSeries = visibleSeries.some(
      (series) =>
        series.actorId === candidatePlayerId || series.ownerId === candidatePlayerId,
    )
    return hasVisibleSeries ? candidatePlayerId : null
  }, [queryState.state.players, selectedPlayerId, visibleSeries])

  const focusedPlayerSummary = useMemo(
    () => {
      if (selectedTargetId === null) {
        return null
      }

      return buildFocusedPlayerSummary({
        events: eventsData?.events ?? [],
        actors: fightData?.actors ?? [],
        fightStartTime: fightData?.startTime ?? 0,
        targetId: selectedTargetId,
        focusedPlayerId,
        windowStartMs: selectedWindowStartMs,
        windowEndMs: selectedWindowEndMs,
      })
    },
    [
      eventsData?.events,
      fightData?.actors,
      fightData?.startTime,
      focusedPlayerId,
      selectedTargetId,
      selectedWindowEndMs,
      selectedWindowStartMs,
    ],
  )

  const focusedPlayerRows = useMemo(
    () => {
      if (selectedTargetId === null) {
        return []
      }

      return buildFocusedPlayerThreatRows({
        events: eventsData?.events ?? [],
        actors: fightData?.actors ?? [],
        abilities: reportData?.abilities ?? [],
        fightStartTime: fightData?.startTime ?? 0,
        targetId: selectedTargetId,
        focusedPlayerId,
        windowStartMs: selectedWindowStartMs,
        windowEndMs: selectedWindowEndMs,
      })
    },
    [
      eventsData?.events,
      fightData?.actors,
      fightData?.startTime,
      focusedPlayerId,
      reportData?.abilities,
      selectedTargetId,
      selectedWindowEndMs,
      selectedWindowStartMs,
    ],
  )

  const handleTargetChange = useCallback(
    (targetId: number) => {
      queryState.setTargetId(targetId)
    },
    [queryState],
  )

  const handleSeriesClick = useCallback(
    (playerId: number) => {
      setSelectedPlayerId(playerId)
    },
    [],
  )

  const handleWindowChange = useCallback(
    (startMs: number | null, endMs: number | null) => {
      queryState.setWindow(startMs, endMs)
    },
    [queryState],
  )

  if (!reportId || Number.isNaN(fightId)) {
    return (
      <ErrorState
        message="Fight route requires both reportId and fightId."
        title="Invalid fight route"
      />
    )
  }

  if (reportQuery.isLoading || fightQuery.isLoading || eventsQuery.isLoading) {
    return <LoadingState message="Loading fight data and threat events..." />
  }

  if (reportQuery.error || !reportData) {
    return (
      <ErrorState
        message={reportQuery.error?.message ?? 'Report metadata unavailable.'}
        title="Unable to load report"
      />
    )
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

  const threatConfigLabel = reportData.threatConfig
    ? `${reportData.threatConfig.displayName} (${reportData.threatConfig.version})`
    : 'No supported config'

  return (
    <div className="space-y-5">
      <SectionCard
        title={`${fightData.name} (Fight #${fightData.id})`}
        subtitle={`${reportData.title} · ${fightData.kill ? 'Kill' : 'Wipe'} · ${Math.round(durationMs / 1000)}s`}
        headerRight={
          <div className="text-right text-xs text-muted">
            <p>Threat config: {threatConfigLabel}</p>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link className="underline" to={`/report/${reportId}`}>
            Back to report
          </Link>
          <a
            className="underline"
            href={buildReportUrl(locationState?.host ?? reportHost, reportId)}
            rel="noreferrer"
            target="_blank"
          >
            Open report on Warcraft Logs
          </a>
          <a
            className="underline"
            href={buildFightRankingsUrl(
              locationState?.host ?? reportHost,
              reportId,
              fightId,
            )}
            rel="noreferrer"
            target="_blank"
          >
            Open this fight on Warcraft Logs
          </a>
        </div>
      </SectionCard>

      <SectionCard
        title="Threat timeline"
        subtitle="Player threat lines with a scrollable legend sorted by total threat. Click a line to focus a player. Selected target is synced with URL query params for deep linking."
        headerRight={
          selectedTargetId ? (
            <div className="border-l border-border pl-3">
              <TargetSelector
                enemies={fightData.enemies}
                selectedTargetId={selectedTargetId}
                onChange={handleTargetChange}
              />
            </div>
          ) : (
            <p className="text-sm text-muted">No valid targets available.</p>
          )
        }
      >
        {selectedTargetId === null ? (
          <p className="text-sm text-muted">No valid targets available for this fight.</p>
        ) : visibleSeries.length === 0 ? (
          <p className="text-sm text-muted">No threat points are available for this target.</p>
        ) : (
          <ThreatChart
            series={visibleSeries}
            windowEndMs={queryState.state.endMs}
            windowStartMs={queryState.state.startMs}
            onSeriesClick={handleSeriesClick}
            onWindowChange={handleWindowChange}
          />
        )}
      </SectionCard>

      <SectionCard
        title="Focused player summary"
        subtitle="Totals and ability TPS are calculated from the currently visible chart window."
      >
        <PlayerSummaryTable summary={focusedPlayerSummary} rows={focusedPlayerRows} />
      </SectionCard>
    </div>
  )
}
