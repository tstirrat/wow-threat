/**
 * Render recent reports from local history.
 */
import { usePostHog } from 'posthog-js/react'
import type { FC } from 'react'

import type {
  ExampleReportLink,
  RecentReportEntry,
  StarredReportEntry,
} from '../types/app'
import { ExampleReportList } from './example-report-list'
import { ReportRow } from './report-row'

export type RecentReportsListProps = {
  reports: RecentReportEntry[]
  onRemoveReport: (reportId: string) => void
  exampleReports?: ExampleReportLink[]
  starredReportIds?: Set<string>
  onToggleStarReport?: (
    report: Omit<StarredReportEntry, 'starredAt'> & { starredAt?: number },
  ) => void
}

export const RecentReportsList: FC<RecentReportsListProps> = ({
  reports,
  onRemoveReport,
  exampleReports,
  starredReportIds,
  onToggleStarReport,
}) => {
  const posthog = usePostHog()
  if (reports.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Reports you open appear here.
        </p>
        {exampleReports && exampleReports.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Example logs
            </p>
            <ExampleReportList examples={exampleReports} />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <ul aria-label="Recent reports" className="-mx-2 space-y-0.5">
      {reports.map((report) => {
        const isArchived = report.isArchived === true
        const isDisabled = isArchived || report.isAccessible === false

        return (
          <ReportRow
            key={report.reportId}
            guildFaction={report.guildFaction}
            guildName={report.guildName}
            isDisabled={isDisabled}
            isStarred={starredReportIds?.has(report.reportId) ?? false}
            reportId={report.reportId}
            statusLabel={
              isDisabled
                ? isArchived
                  ? 'archived'
                  : 'inaccessible'
                : undefined
            }
            sourceHost={report.sourceHost}
            startTime={report.startTime ?? report.lastOpenedAt}
            title={report.title}
            zoneName={report.zoneName}
            onOpen={() => {
              posthog?.capture('recents_opened', { report_id: report.reportId })
            }}
            onRemove={() => {
              onRemoveReport(report.reportId)
            }}
            onToggleStar={
              onToggleStarReport
                ? () => {
                    onToggleStarReport({
                      reportId: report.reportId,
                      title: report.title,
                      sourceHost: report.sourceHost,
                      zoneName: report.zoneName ?? null,
                      startTime: report.startTime ?? null,
                      bossKillCount: report.bossKillCount ?? null,
                      guildName: report.guildName ?? null,
                      guildFaction: report.guildFaction ?? null,
                    })
                  }
                : undefined
            }
          />
        )
      })}
    </ul>
  )
}
