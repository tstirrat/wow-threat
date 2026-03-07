/**
 * Report landing route content under the shared report layout.
 */
import type { FC } from 'react'

import { SectionCard } from '../components/section-card'
import { useReportRouteContext } from '../routes/report-layout-context'

/** Render a zero state prompt below the shared report layout chrome. */
export const ReportPage: FC = () => {
  const { reportData, reportId } = useReportRouteContext()
  const reportTitle = reportData.title.trim() || reportId

  return (
    <>
      <title>{`${reportTitle} | WOW Threat`}</title>
      <SectionCard
        title="Choose a fight"
        subtitle="Select a boss kill above to load threat details for that encounter."
      >
        <p className="text-sm text-muted-foreground">
          Choose a fight from the quick switcher to view the chart and legend.
        </p>
      </SectionCard>
    </>
  )
}
