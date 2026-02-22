/**
 * Render merged personal and guild recent reports from Warcraft Logs.
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import { defaultHost } from '../lib/constants'
import { formatReportHeaderDate } from '../lib/format'
import { cn } from '../lib/utils'
import type { RecentReportSummary } from '../types/api'
import { Card, CardContent } from './ui/card'

export type AccountRecentReportsListProps = {
  reports: RecentReportSummary[]
}

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

function resolveSourceLabel(source: RecentReportSummary['source']): string {
  return source === 'guild' ? 'guild log' : 'personal log'
}

export const AccountRecentReportsList: FC<AccountRecentReportsListProps> = ({
  reports,
}) => {
  if (reports.length === 0) {
    return (
      <Card className="bg-panel" size="sm">
        <CardContent className="space-y-1">
          <p className="font-medium text-muted-foreground">
            No recent Warcraft Logs history yet
          </p>
          <p className="text-xs text-muted-foreground">
            Run a personal or guild log to populate this list.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ul aria-label="Recent Warcraft Logs" className="space-y-2">
      {reports.map((report) => {
        const guildName = report.guildName ? `<${report.guildName}>` : null
        const titleParts = [report.title || report.code, guildName]
          .filter((value): value is string => Boolean(value))
          .join(' ')
        const zoneLabel = report.zoneName ?? 'Unknown zone'
        const startLabel = formatReportHeaderDate(report.startTime)
        const sourceLabel = resolveSourceLabel(report.source)
        const titleRowClass = resolveTitleRowClass(
          normalizeGuildFaction(report.guildFaction),
        )

        return (
          <li key={report.code}>
            <Card className="bg-panel" size="sm">
              <CardContent className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    className={cn(
                      'min-w-0 truncate font-medium underline',
                      titleRowClass,
                    )}
                    state={{ host: defaultHost }}
                    to={`/report/${report.code}`}
                  >
                    {titleParts}
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">
                  {zoneLabel} - {startLabel} - {sourceLabel}
                </p>
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
