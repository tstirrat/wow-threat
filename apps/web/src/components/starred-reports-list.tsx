/**
 * Render starred reports from user preferences.
 */
import type { FC } from 'react'

import type { StarredReportEntry } from '../types/app'
import { ReportRow } from './report-row'

export interface StarredReportsListProps {
  reports: StarredReportEntry[]
  onToggleStarReport: (reportId: string) => void
}

/** Render persisted starred reports as two-line rows. */
export const StarredReportsList: FC<StarredReportsListProps> = ({
  reports,
  onToggleStarReport,
}) => {
  if (reports.length === 0) {
    return (
      <div className="space-y-0.5 py-1">
        <p className="text-xs font-medium text-muted-foreground">
          No starred reports
        </p>
        <p className="text-xs text-muted-foreground">
          Star a report to keep it here.
        </p>
      </div>
    )
  }

  return (
    <ul aria-label="Starred reports" className="-mx-2 space-y-0.5">
      {reports.map((report) => (
        <ReportRow
          key={report.reportId}
          guildFaction={report.guildFaction}
          guildName={report.guildName}
          isStarred
          reportId={report.reportId}
          sourceHost={report.sourceHost}
          startTime={report.startTime ?? report.starredAt}
          title={report.title}
          zoneName={report.zoneName}
          onToggleStar={() => {
            onToggleStarReport(report.reportId)
          }}
        />
      ))}
    </ul>
  )
}
