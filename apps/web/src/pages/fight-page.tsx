/**
 * Fight-level page with target filter and player-focused chart interactions.
 */
import { ExternalLink } from 'lucide-react'
import { type FC, Suspense, useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import { ErrorState } from '../components/error-state'
import { PlayerSummaryTable } from '../components/player-summary-table'
import { SectionCard } from '../components/section-card'
import { TargetSelector } from '../components/target-selector'
import { ThreatChart, type ThreatChartProps } from '../components/threat-chart'
import { Skeleton } from '../components/ui/skeleton'
import { useFightData } from '../hooks/use-fight-data'
import {
  useFightEvents,
  useSuspenseFightEvents,
} from '../hooks/use-fight-events'
import { useUserSettings } from '../hooks/use-user-settings'
import { formatClockDuration } from '../lib/format'
import { resolveCurrentThreatConfig } from '../lib/threat-config'
import { buildFightRankingsUrl } from '../lib/wcl-url'
import { useReportRouteContext } from '../routes/report-layout-context'
import { useFightPageDerivedState } from './hooks/use-fight-page-derived-state'
import { useFightPageInteractions } from './hooks/use-fight-page-interactions'

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

const FightChartLoadingSkeleton: FC = () => {
  return (
    <section
      aria-label="Loading fight events chart"
      aria-live="polite"
      role="status"
    >
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton
          className="h-[560px] w-full"
          data-testid="fight-chart-skeleton"
        />
      </div>
    </section>
  )
}

const FightTimelineContent: FC<{
  reportId: string
  fightId: number
  inferThreatReduction: boolean
  chartProps: ThreatChartProps
}> = ({ reportId, fightId, inferThreatReduction, chartProps }) => {
  useSuspenseFightEvents(reportId, fightId, inferThreatReduction)

  if (chartProps.series.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No threat points are available for this target.
      </p>
    )
  }

  return <ThreatChart {...chartProps} />
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
  const fightData = fightQuery.data ?? null
  const eventsQueryEnabled = !isUserSettingsLoading
  const eventsQuery = useFightEvents(
    reportId,
    fightId,
    userSettings.inferThreatReduction,
    eventsQueryEnabled,
  )
  const eventsData = eventsQuery.data ?? null

  const {
    focusedPlayerRows,
    focusedPlayerSummary,
    initialAuras,
    queryState,
    selectedTarget,
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
    handleInferThreatReductionChange,
    handleSeriesClick,
    handleShowBossMeleeChange,
    handleShowEnergizeEventsChange,
    handleShowPetsChange,
    handleTargetChange,
    handleVisiblePlayerIdsChange,
    handleWindowChange,
  } = useFightPageInteractions({
    queryState,
    updateUserSettings,
    validPlayerIds,
  })

  if (!reportId || Number.isNaN(fightId)) {
    return (
      <ErrorState
        message="Fight route requires both reportId and fightId."
        title="Invalid fight route"
      />
    )
  }

  if (fightQuery.isLoading) {
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

  if (eventsQuery.error) {
    return (
      <ErrorState
        message={eventsQuery.error?.message ?? 'Fight events unavailable.'}
        title="Unable to load threat events"
      />
    )
  }

  if (
    !isUserSettingsLoading &&
    eventsQueryEnabled &&
    !eventsQuery.isLoading &&
    !eventsData
  ) {
    return (
      <ErrorState
        message="Fight events unavailable."
        title="Unable to load threat events"
      />
    )
  }

  const chartProps: ThreatChartProps = {
    renderer: chartRenderer,
    series: visibleSeries,
    selectedPlayerIds: queryState.state.players,
    onVisiblePlayerIdsChange: handleVisiblePlayerIdsChange,
    windowEndMs: queryState.state.endMs,
    windowStartMs: queryState.state.startMs,
    onSeriesClick: handleSeriesClick,
    onWindowChange: handleWindowChange,
    showPets: userSettings.showPets,
    onShowPetsChange: handleShowPetsChange,
    showEnergizeEvents: userSettings.showEnergizeEvents,
    onShowEnergizeEventsChange: handleShowEnergizeEventsChange,
    showBossMelee: userSettings.showBossMelee,
    onShowBossMeleeChange: handleShowBossMeleeChange,
    inferThreatReduction: userSettings.inferThreatReduction,
    onInferThreatReductionChange: handleInferThreatReductionChange,
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
        ) : isUserSettingsLoading ? (
          <FightChartLoadingSkeleton />
        ) : (
          <Suspense fallback={<FightChartLoadingSkeleton />}>
            <FightTimelineContent
              reportId={reportId}
              fightId={fightId}
              inferThreatReduction={userSettings.inferThreatReduction}
              chartProps={chartProps}
            />
          </Suspense>
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
          />
        </SectionCard>
      ) : null}
    </div>
  )
}
