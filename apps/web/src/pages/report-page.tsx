/**
 * Report landing route content under the shared report layout.
 */
import type { FC } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { buildBossKillNavigationFights } from '../lib/fight-navigation'
import { useReportRouteContext } from '../routes/report-layout-context'

/** Redirect to the report's first fight; fall back to a zero state prompt when it has none. */
export const ReportPage: FC = () => {
  const { reportData, reportId } = useReportRouteContext()
  const { search, state } = useLocation()
  const reportTitle = reportData.title.trim() || reportId
  const firstFight =
    buildBossKillNavigationFights(reportData.fights)[0] ?? reportData.fights[0]

  if (firstFight) {
    return (
      <Navigate
        replace
        state={state}
        to={`/report/${reportId}/fight/${firstFight.id}${search}`}
      />
    )
  }

  return (
    <>
      <title>{`${reportTitle} | WOW Threat`}</title>
      <section
        aria-labelledby="report-zero-state-title"
        className="flex h-full min-h-60 flex-col items-center justify-center gap-1 surface-canvas px-4 text-center"
      >
        <h2 className="text-sm font-medium" id="report-zero-state-title">
          Choose a fight
        </h2>
        <p className="max-w-xs text-xs text-muted-foreground">
          Select a boss kill in the sidebar to load its threat chart.
        </p>
      </section>
    </>
  )
}
