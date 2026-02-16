/**
 * Fight-level page with target filter and player-focused chart interactions.
 */
import { resolveConfigOrNull } from '@wcl-threat/threat-config'
import { type FC, useCallback, useEffect, useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { ErrorState } from '../components/error-state'
import { LoadingState } from '../components/loading-state'
import { PlayerSummaryTable } from '../components/player-summary-table'
import { SectionCard } from '../components/section-card'
import { TargetSelector } from '../components/target-selector'
import { ThreatChart } from '../components/threat-chart'
import { useFightData } from '../hooks/use-fight-data'
import { useFightEvents } from '../hooks/use-fight-events'
import { useFightQueryState } from '../hooks/use-fight-query-state'
import { useRecentReports } from '../hooks/use-recent-reports'
import { useReportData } from '../hooks/use-report-data'
import { useReportHost } from '../hooks/use-report-host'
import { buildBossKillNavigationFights } from '../lib/fight-navigation'
import {
  buildFightTargetOptions,
  buildFocusedPlayerSummary,
  buildFocusedPlayerThreatRows,
  buildInitialAurasDisplay,
  buildThreatSeries,
  resolveSeriesWindowBounds,
  selectDefaultTarget,
} from '../lib/threat-aggregation'
import { buildFightRankingsUrl, buildReportUrl } from '../lib/wcl-url'
import type {
  ThreatSeries,
  WarcraftLogsHost,
  WowheadLinksConfig,
} from '../types/app'

interface LocationState {
  host?: WarcraftLogsHost
}

const defaultWowheadLinksConfig: WowheadLinksConfig = {
  domain: 'classic',
}

function isTotemPetSeries(series: ThreatSeries): boolean {
  return series.actorType === 'Pet' && /\btotem\b/i.test(series.actorName)
}

function areEqualIdLists(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((id, index) => id === right[index])
}

export const FightPage: FC = () => {
  const params = useParams<{ reportId: string; fightId: string }>()
  const location = useLocation()
  const locationState = location.state as LocationState | null

  const reportId = params.reportId ?? ''
  const fightId = Number.parseInt(params.fightId ?? '', 10)
  const chartRenderer =
    new URLSearchParams(location.search).get('renderer') === 'svg'
      ? 'svg'
      : 'canvas'

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
  }, [
    addRecentReport,
    locationState?.host,
    reportHost,
    reportId,
    reportQuery.data,
  ])

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

  const threatConfig = useMemo(() => {
    if (!reportData) {
      return null
    }

    return resolveConfigOrNull({
      report: {
        startTime: reportData.startTime,
        masterData: {
          gameVersion: reportData.gameVersion,
        },
        zone: reportData.zone,
        fights: reportData.fights.map(() => ({
          classicSeasonID: null,
        })),
      },
    })
  }, [reportData])

  const queryState = useFightQueryState({
    validPlayerIds,
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
    () =>
      allSeries
        .filter(
          (series) =>
            series.actorType === 'Player' ||
            (queryState.state.pets && !isTotemPetSeries(series)),
        )
        .sort((a, b) => b.totalThreat - a.totalThreat),
    [allSeries, queryState.state.pets],
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
      (series) =>
        series.actorId === candidatePlayerId ||
        series.ownerId === candidatePlayerId,
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
    selectedTarget,
    selectedWindowEndMs,
    selectedWindowStartMs,
  ])

  const focusedPlayerRows = useMemo(() => {
    if (selectedTarget === null) {
      return []
    }

    return buildFocusedPlayerThreatRows({
      events: eventsData?.events ?? [],
      actors: fightData?.actors ?? [],
      abilities: reportData?.abilities ?? [],
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
    reportData?.abilities,
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
      ),
    [eventsData?.events, focusedPlayerId, threatConfig],
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
  const bossKillFights = buildBossKillNavigationFights(reportData.fights)

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
          <span className="text-muted">Warcraft Logs:</span>
          <a
            className="underline"
            href={buildReportUrl(locationState?.host ?? reportHost, reportId)}
            rel="noreferrer"
            target="_blank"
          >
            Report
          </a>
          <span className="text-muted">|</span>
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
            Fight
          </a>
        </div>
      </SectionCard>

      <div className="rounded-xl border border-border bg-panel px-4 py-3 shadow-sm">
        <nav aria-label="Fight quick switch">
          {bossKillFights.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {bossKillFights.map((fight, fightIndex) => {
                const isCurrentFight = fight.id === fightId
                const fightLabel = fight.name

                return (
                  <li className="inline-flex items-center gap-2" key={fight.id}>
                    {fightIndex > 0 ? (
                      <span className="text-muted">|</span>
                    ) : null}
                    {isCurrentFight ? (
                      <span className="font-medium">{fightLabel}</span>
                    ) : (
                      <Link
                        className="underline"
                        to={`/report/${reportId}/fight/${fight.id}${location.search}`}
                      >
                        {fightLabel}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              No boss kills found in this report.
            </p>
          )}
        </nav>
      </div>

      <SectionCard
        title="Threat timeline"
        headerRight={
          selectedTarget ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  checked={queryState.state.pets}
                  className="h-4 w-4"
                  type="checkbox"
                  onChange={(event) => {
                    queryState.setPets(event.target.checked)
                  }}
                />
                Show pets
              </label>
              <div className="border-l border-border pl-3">
                <TargetSelector
                  targets={targetOptions}
                  selectedTarget={selectedTarget}
                  onChange={handleTargetChange}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">No valid targets available.</p>
          )
        }
      >
        {selectedTarget === null ? (
          <p className="text-sm text-muted">
            No valid targets available for this fight.
          </p>
        ) : visibleSeries.length === 0 ? (
          <p className="text-sm text-muted">
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
