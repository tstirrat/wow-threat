/**
 * Shared report route layout with compact header and fight quick switcher.
 */
import { type FC, useEffect } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'

import { ErrorState } from '../components/error-state'
import { FightQuickSwitcher } from '../components/fight-quick-switcher'
import { LoadingState } from '../components/loading-state'
import { ReportSummaryHeader } from '../components/report-summary-header'
import { useRecentReports } from '../hooks/use-recent-reports'
import { useReportData } from '../hooks/use-report-data'
import { useReportHost } from '../hooks/use-report-host'
import type { ReportRouteContext } from './report-layout-context'
import type { WarcraftLogsHost } from '../types/app'

interface LocationState {
  host?: WarcraftLogsHost
}

/** Render report-scoped chrome shared by report landing and fight pages. */
export const ReportLayout: FC = () => {
  const params = useParams<{ reportId: string; fightId?: string }>()
  const reportId = params.reportId ?? ''
  const fightId = Number.parseInt(params.fightId ?? '', 10)

  const location = useLocation()
  const locationState = location.state as LocationState | null

  const { recentReports, addRecentReport } = useRecentReports()
  const fallbackHost = useReportHost(reportId, recentReports)
  const reportHost = locationState?.host ?? fallbackHost
  const { data, isLoading, error } = useReportData(reportId)

  useEffect(() => {
    if (!data) {
      return
    }

    addRecentReport({
      reportId,
      title: data.title,
      sourceHost: reportHost,
      lastOpenedAt: Date.now(),
    })
  }, [addRecentReport, data, reportHost, reportId])

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
    ? `${data.threatConfig.displayName} ${data.threatConfig.version}`
    : 'No supported config'
  const selectedFightId = Number.isNaN(fightId) ? null : fightId
  const outletContext: ReportRouteContext = {
    reportId,
    reportData: data,
    reportHost,
  }

  return (
    <div className="space-y-5">
      <ReportSummaryHeader
        report={data}
        reportHost={reportHost}
        reportId={reportId}
        threatConfigLabel={threatConfigLabel}
      />
      <FightQuickSwitcher
        fights={data.fights}
        reportId={reportId}
        selectedFightId={selectedFightId}
      />
      <Outlet context={outletContext} />
    </div>
  )
}
