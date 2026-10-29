/**
 * Report landing route content under the shared report layout.
 */
import type { FC } from 'react'

import { useReportRouteContext } from '../routes/report-layout-context'

/** Render a zero state prompt in the empty fight workspace area. */
export const ReportPage: FC = () => {
  const { reportData, reportId } = useReportRouteContext()
  const reportTitle = reportData.title.trim() || reportId

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
