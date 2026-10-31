/**
 * Render merged personal and guild recent reports from Warcraft Logs.
 */
import type { FC } from 'react'

import { defaultHost } from '../lib/constants'
import type { RecentReportSummary } from '../types/api'
import type { StarredReportEntry } from '../types/app'
import { ReportRow } from './report-row'

export type AccountRecentReportsListProps = {
  reports: RecentReportSummary[]
  starredReportIds?: Set<string>
  onToggleStarReport?: (
    report: Omit<StarredReportEntry, 'starredAt'> & { starredAt?: number },
  ) => void
}

export const AccountRecentReportsList: FC<AccountRecentReportsListProps> = ({
  reports,
  starredReportIds,
  onToggleStarReport,
}) => {
  if (reports.length === 0) {
    return (
      <div className="space-y-0.5 py-1">
        <p className="text-xs font-medium text-muted-foreground">
          No recent Warcraft Logs history yet
        </p>
        <p className="text-xs text-muted-foreground">
          Run a personal or guild log to populate this list.
        </p>
      </div>
    )
  }

  return (
    <ul aria-label="Recent Warcraft Logs" className="-mx-2 space-y-0.5">
      {reports.map((report) => (
        <ReportRow
          key={report.code}
          guildFaction={report.guildFaction}
          guildName={report.guildName}
          isStarred={starredReportIds?.has(report.code) ?? false}
          reportId={report.code}
          sourceHost={defaultHost}
          startTime={report.startTime}
          title={report.title}
          zoneName={report.zoneName}
          onToggleStar={
            onToggleStarReport
              ? () => {
                  onToggleStarReport({
                    reportId: report.code,
                    title: report.title,
                    sourceHost: defaultHost,
                    zoneName: report.zoneName,
                    startTime: report.startTime,
                    bossKillCount: null,
                    guildName: report.guildName,
                    guildFaction: report.guildFaction,
                  })
                }
              : undefined
          }
        />
      ))}
    </ul>
  )
}
