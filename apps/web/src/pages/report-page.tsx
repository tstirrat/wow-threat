/**
 * Report-level page with fights and player navigation.
 */
import { useEffect, type FC } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import { ErrorState } from '../components/error-state'
import { FightsList } from '../components/fights-list'
import { LoadingState } from '../components/loading-state'
import { PlayersNavigationList } from '../components/players-navigation-list'
import { SectionCard } from '../components/section-card'
import { buildReportUrl } from '../lib/wcl-url'
import { useReportData } from '../hooks/use-report-data'
import { useReportHost } from '../hooks/use-report-host'
import { useRecentReports } from '../hooks/use-recent-reports'
import type { WarcraftLogsHost } from '../types/app'

interface LocationState {
  host?: WarcraftLogsHost
}

export const ReportPage: FC = () => {
  const params = useParams<{ reportId: string }>()
  const reportId = params.reportId ?? ''
  const location = useLocation()
  const locationState = location.state as LocationState | null

  const { recentReports, addRecentReport } = useRecentReports()
  const reportHost = useReportHost(reportId, recentReports)

  const { data, isLoading, error } = useReportData(reportId)

  const players = data?.actors.filter((actor) => actor.type === 'Player') ?? []

  useEffect(() => {
    if (!data) {
      return
    }

    addRecentReport({
      reportId,
      title: data.title,
      sourceHost: locationState?.host ?? reportHost,
      lastOpenedAt: Date.now(),
    })
  }, [addRecentReport, data, locationState?.host, reportHost, reportId])

  if (!reportId) {
    return (
      <ErrorState
        message="The report route is missing a report code."
        title="Invalid report route"
      />
    )
  }

  if (isLoading) {
    return <LoadingState message="Loading report metadata..." />
  }

  if (error || !data) {
    return (
      <ErrorState
        message={error?.message ?? 'Report data was not returned.'}
        title="Unable to load report"
      />
    )
  }

  const threatConfigLabel = data.threatConfig
    ? `${data.threatConfig.displayName} (${data.threatConfig.version})`
    : 'No supported config'

  return (
    <div className="space-y-5">
      <SectionCard
        title={data.title}
        subtitle={`Report ${data.code} · ${data.zone.name}`}
        headerRight={
          <div className="text-right text-xs text-muted">
            <p>Threat config: {threatConfigLabel}</p>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted">Owner: {data.owner}</span>
          <span className="text-muted">Fights: {data.fights.length}</span>
          <span className="text-muted">Players: {players.length}</span>
          <a
            className="underline"
            href={buildReportUrl(locationState?.host ?? reportHost, reportId)}
            rel="noreferrer"
            target="_blank"
          >
            Open report on Warcraft Logs
          </a>
        </div>
      </SectionCard>

      <SectionCard
        title="Fight navigation"
        subtitle="Browse every fight in this report using direct links."
      >
        <FightsList fights={data.fights} reportId={reportId} />
      </SectionCard>

      <SectionCard
        title="Player navigation"
        subtitle="Players by boss-kill grid. Empty cells mean the player did not participate."
      >
        <PlayersNavigationList fights={data.fights} players={players} reportId={reportId} />
      </SectionCard>
    </div>
  )
}
