/**
 * Render merged report feed sourced from starred guilds.
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import { formatReportHeaderDate } from '../lib/format'
import { cn } from '../lib/utils'
import type { StarredGuildReportEntry } from '../types/app'
import { Card, CardContent } from './ui/card'

type ReportGuildFaction = 'alliance' | 'horde' | null

function normalizeGuildFaction(
  value: string | null | undefined,
): ReportGuildFaction {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'alliance') {
    return 'alliance'
  }
  if (normalized === 'horde') {
    return 'horde'
  }

  return null
}

function resolveTitleRowClass(faction: ReportGuildFaction): string {
  if (faction === 'alliance') {
    return 'text-sky-600 dark:text-sky-400'
  }
  if (faction === 'horde') {
    return 'text-red-600 dark:text-red-400'
  }

  return ''
}

export interface StarredGuildReportsListProps {
  reports: StarredGuildReportEntry[]
}

/** Render guild-sourced reports in compact cards. */
export const StarredGuildReportsList: FC<StarredGuildReportsListProps> = ({
  reports,
}) => {
  if (reports.length === 0) {
    return (
      <Card className="bg-panel" size="sm">
        <CardContent className="space-y-1">
          <p className="font-medium text-muted-foreground">
            No guild reports yet
          </p>
          <p className="text-xs text-muted-foreground">
            Star a guild from a report header to populate this feed.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ul aria-label="Starred guild reports" className="space-y-2">
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
            <Card className="bg-panel" size="sm">
              <CardContent className="space-y-1">
                <Link
                  className={cn(
                    'truncate font-medium underline',
                    titleRowClass,
                  )}
                  state={{ host: report.sourceHost }}
                  to={`/report/${report.reportId}`}
                >
                  {titleParts}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {zoneLabel} - {startLabel}
                </p>
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
