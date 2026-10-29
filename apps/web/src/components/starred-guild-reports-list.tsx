/**
 * Render merged report feed sourced from starred guilds.
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import { formatReportHeaderDate } from '../lib/format'
import {
  normalizeGuildFaction,
  resolveTitleRowClass,
} from '../lib/guild-faction'
import { cn } from '../lib/utils'
import type { StarredGuildReportEntry } from '../types/app'

export interface StarredGuildReportsListProps {
  reports: StarredGuildReportEntry[]
}

/** Render guild-sourced reports in compact cards. */
export const StarredGuildReportsList: FC<StarredGuildReportsListProps> = ({
  reports,
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
      {reports.map((report) => {
        const guildName = report.guildName ? `<${report.guildName}>` : null
        const titleParts = [report.title || report.reportId, guildName]
          .filter((value): value is string => Boolean(value))
          .join(' ')
        const startLabel = formatReportHeaderDate(report.startTime)
        const zoneLabel = report.zoneName ?? 'Unknown zone'
        const titleRowClass = resolveTitleRowClass(
          normalizeGuildFaction(report.guildFaction),
        )

        return (
          <li key={report.reportId}>
            <div className="space-y-0.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
              <Link
                className={cn('truncate font-medium underline', titleRowClass)}
                state={{ host: report.sourceHost }}
                to={`/report/${report.reportId}`}
              >
                {titleParts}
              </Link>
              <p className="text-xs text-muted-foreground">
                {zoneLabel} - {startLabel}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
