/**
 * Render merged report feed sourced from starred guilds.
 */
import type { FC } from 'react'

import type { StarredGuildReportEntry, StarredReportEntry } from '../types/app'
import { ReportRow } from './report-row'

export interface StarredGuildReportsListProps {
  reports: StarredGuildReportEntry[]
  /** Append the guild tag to each title; off when the guild is shown as a heading. */
  showGuild?: boolean
  starredReportIds?: Set<string>
  onToggleStarReport?: (
    report: Omit<StarredReportEntry, 'starredAt'> & { starredAt?: number },
  ) => void
}

/** Render guild-sourced reports as two-line rows. */
export const StarredGuildReportsList: FC<StarredGuildReportsListProps> = ({
  reports,
  showGuild = true,
  starredReportIds,
  onToggleStarReport,
}) => {
  if (reports.length === 0) {
    return (
      <div className="space-y-0.5 py-1">
        <p className="text-xs font-medium text-muted-foreground">
          No guild reports yet
        </p>
        <p className="text-xs text-muted-foreground">
          Star a guild from a report header to populate this feed.
        </p>
      </div>
    )
  }

  return (
    <ul aria-label="Starred guild reports" className="-mx-2 space-y-0.5">
      {reports.map((report) => (
        <ReportRow
          key={report.reportId}
          guildFaction={report.guildFaction}
          guildName={showGuild ? report.guildName : null}
          isStarred={starredReportIds?.has(report.reportId) ?? false}
          reportId={report.reportId}
          sourceHost={report.sourceHost}
          startTime={report.startTime}
          title={report.title}
          zoneName={report.zoneName}
          onToggleStar={
            onToggleStarReport
              ? () => {
                  onToggleStarReport({
                    reportId: report.reportId,
                    title: report.title,
                    sourceHost: report.sourceHost,
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
