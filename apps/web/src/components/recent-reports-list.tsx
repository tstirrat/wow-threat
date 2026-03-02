/**
 * Render recent reports from local history.
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import { formatReportHeaderDate } from '../lib/format'
import { cn } from '../lib/utils'
import type {
  ExampleReportLink,
  RecentReportEntry,
  StarredReportEntry,
} from '../types/app'
import { ExampleReportList } from './example-report-list'
import { ReportStarButton } from './report-star-button'
import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'

export type RecentReportsListProps = {
  reports: RecentReportEntry[]
  onRemoveReport: (reportId: string) => void
  exampleReports?: ExampleReportLink[]
  starredReportIds?: Set<string>
  onToggleStarReport?: (
    report: Omit<StarredReportEntry, 'starredAt'> & { starredAt?: number },
  ) => void
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

function resolveSourceLabel(report: RecentReportEntry): string {
  const hostPrefix = report.sourceHost.split('.')[0]?.toLowerCase()

  return hostPrefix ?? 'unknown'
}

export const RecentReportsList: FC<RecentReportsListProps> = ({
  reports,
  onRemoveReport,
  exampleReports,
  starredReportIds,
  onToggleStarReport,
}) => {
  if (reports.length === 0) {
    return (
      <Card className="bg-panel" size="sm">
        <CardContent className="space-y-4">
          <p className="font-medium text-muted-foreground">
            No recent reports yet (fresh)
          </p>
          <p className="text-xs text-muted-foreground">
            Load a report to populate zone - date and time - boss count.
          </p>
          {exampleReports && exampleReports.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Example logs
              </p>
              <ExampleReportList examples={exampleReports} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return (
    <ul aria-label="Recent reports" className="space-y-2">
      {reports.map((report) => {
        const isArchived = report.isArchived === true
        const isInaccessible = report.isAccessible === false
        const isDisabled = isArchived || isInaccessible
        const guildName = report.guildName ? `<${report.guildName}>` : null
        const sourceLabel = resolveSourceLabel(report)
        const titleParts = [report.title || report.reportId, guildName]
          .filter((value): value is string => Boolean(value))
          .join(' ')
        const firstLine = `${titleParts} (${sourceLabel})`
        const zoneLabel = report.zoneName ?? 'Unknown zone'
        const startLabel =
          typeof report.startTime === 'number'
            ? formatReportHeaderDate(report.startTime)
            : new Date(report.lastOpenedAt).toLocaleString()
        const bossesLabel =
          typeof report.bossKillCount === 'number'
            ? `${report.bossKillCount} ${report.bossKillCount === 1 ? 'boss' : 'bosses'}`
            : 'unknown bosses'
        const statusLabel = isArchived ? 'archived' : 'inaccessible'
        const titleRowClass = resolveTitleRowClass(
          normalizeGuildFaction(report.guildFaction),
        )

        return (
          <li key={report.reportId}>
            <Card className="bg-panel" size="sm">
              <CardContent className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  {isDisabled ? (
                    <span
                      className={cn(
                        'min-w-0 truncate font-medium text-muted-foreground',
                      )}
                    >
                      {firstLine}
                    </span>
                  ) : (
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
                  )}
                  <div className="flex items-center gap-1">
                    {onToggleStarReport ? (
                      <ReportStarButton
                        ariaLabel={`${starredReportIds?.has(report.reportId) ? 'Unstar' : 'Star'} report ${report.title || report.reportId}`}
                        isDisabled={isDisabled}
                        isStarred={
                          starredReportIds?.has(report.reportId) ?? false
                        }
                        onToggle={() => {
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
                        }}
                      />
                    ) : null}
                    <button
                      aria-label={`Remove recent report ${report.title || report.reportId}`}
                      className="cursor-pointer text-xs leading-none text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        onRemoveReport(report.reportId)
                      }}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {zoneLabel} - {startLabel} - {bossesLabel}
                </p>
                {isDisabled ? (
                  <Badge className="mt-1" variant="secondary">
                    {statusLabel}
                  </Badge>
                ) : null}
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
