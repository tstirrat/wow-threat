/**
 * Render starred reports from user preferences.
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import { formatReportHeaderDate } from '../lib/format'
import {
  normalizeGuildFaction,
  resolveTitleRowClass,
} from '../lib/guild-faction'
import { cn } from '../lib/utils'
import type { StarredReportEntry } from '../types/app'
import { ReportStarButton } from './report-star-button'
import { Card, CardContent } from './ui/card'

export interface StarredReportsListProps {
  reports: StarredReportEntry[]
  onToggleStarReport: (reportId: string) => void
}

function resolveHostPrefixLabel(sourceHost: string): string {
  return sourceHost.split('.')[0]?.toLowerCase() ?? 'unknown'
}

/** Render persisted starred reports in a compact card list. */
export const StarredReportsList: FC<StarredReportsListProps> = ({
  reports,
  onToggleStarReport,
}) => {
  if (reports.length === 0) {
    return (
      <Card size="sm">
        <CardContent className="space-y-1">
          <p className="font-medium text-muted-foreground">
            No starred reports
          </p>
          <p className="text-xs text-muted-foreground">
            Star reports to keep them pinned here and in the header menu.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ul aria-label="Starred reports" className="space-y-2">
      {reports.map((report) => {
        const guildName = report.guildName ? `<${report.guildName}>` : null
        const sourceLabel = resolveHostPrefixLabel(report.sourceHost)
        const titleParts = [report.title || report.reportId, guildName]
          .filter((value): value is string => Boolean(value))
          .join(' ')
        const firstLine = `${titleParts} (${sourceLabel})`
        const zoneLabel = report.zoneName ?? 'Unknown zone'
        const startLabel =
          typeof report.startTime === 'number'
            ? formatReportHeaderDate(report.startTime)
            : new Date(report.starredAt).toLocaleString()
        const bossesLabel =
          typeof report.bossKillCount === 'number'
            ? `${report.bossKillCount} ${report.bossKillCount === 1 ? 'boss' : 'bosses'}`
            : 'unknown bosses'
        const titleRowClass = resolveTitleRowClass(
          normalizeGuildFaction(report.guildFaction),
        )

        return (
          <li key={report.reportId}>
            <Card size="sm">
              <CardContent className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    className={cn(
                      'min-w-0 truncate font-medium underline',
                      titleRowClass,
                    )}
                    state={{ host: report.sourceHost }}
                    to={`/report/${report.reportId}`}
                  >
                    {firstLine}
                  </Link>
                  <ReportStarButton
                    ariaLabel={`Unstar report ${report.title || report.reportId}`}
                    isStarred
                    onToggle={() => {
                      onToggleStarReport(report.reportId)
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {zoneLabel} - {startLabel} - {bossesLabel}
                </p>
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
