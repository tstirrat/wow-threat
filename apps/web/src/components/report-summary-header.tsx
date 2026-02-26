/**
 * Two-line report header shared across report landing and fight routes.
 */
import { ExternalLink } from 'lucide-react'
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import { buildBossKillNavigationFights } from '../lib/fight-navigation'
import { formatReportHeaderDate } from '../lib/format'
import { buildReportUrl } from '../lib/wcl-url'
import type { ReportResponse } from '../types/api'
import type { WarcraftLogsHost } from '../types/app'
import { ReportStarButton } from './report-star-button'
import { Card, CardHeader, CardTitle } from './ui/card'

type ReportGuildFaction = 'alliance' | 'horde' | null

export type ReportSummaryHeaderProps = {
  report: ReportResponse
  reportId: string
  reportHost: WarcraftLogsHost
  threatConfigLabel: string
  selectedFightId?: number | null
  isStarred: boolean
  onToggleStar: () => void
  isStarToggleDisabled?: boolean
}

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

function resolveGuildTextClass(faction: ReportGuildFaction): string {
  if (faction === 'alliance') {
    return 'text-sky-600 dark:text-sky-400'
  }
  if (faction === 'horde') {
    return 'text-red-600 dark:text-red-400'
  }

  return 'text-muted-foreground'
}

function buildGuildEntityPath(report: ReportResponse): string | null {
  const guild = report.guild
  if (!guild) {
    return null
  }

  const hasGuildId = typeof guild.id === 'number' && Number.isFinite(guild.id)
  const hasLookupFallback = Boolean(guild.serverSlug && guild.serverRegion)
  if (!hasGuildId && !hasLookupFallback) {
    return null
  }

  const guildPathId = hasGuildId ? String(guild.id) : 'lookup'
  const searchParams = new URLSearchParams()
  searchParams.set('name', guild.name)
  if (guild.serverSlug) {
    searchParams.set('serverSlug', guild.serverSlug)
  }
  if (guild.serverRegion) {
    searchParams.set('serverRegion', guild.serverRegion)
  }
  const search = searchParams.toString()

  return `/reports/guild/${guildPathId}${search.length > 0 ? `?${search}` : ''}`
}

/** Render compact report metadata with threat config summary. */
export const ReportSummaryHeader: FC<ReportSummaryHeaderProps> = ({
  report,
  reportId,
  reportHost,
  threatConfigLabel,
  selectedFightId = null,
  isStarred,
  onToggleStar,
  isStarToggleDisabled = false,
}) => {
  const reportPlayers = report.actors.filter((actor) => actor.type === 'Player')
  const reportPlayerIds = new Set(reportPlayers.map((actor) => actor.id))
  const selectedFight =
    selectedFightId === null
      ? null
      : (report.fights.find((fight) => fight.id === selectedFightId) ?? null)
  const playerCount = selectedFight
    ? new Set(
        selectedFight.friendlyPlayers.filter((playerId) =>
          reportPlayerIds.has(playerId),
        ),
      ).size
    : reportPlayers.length
  const bossKillCount = buildBossKillNavigationFights(report.fights).length
  const guildName = report.guild?.name ?? null
  const guildFaction = normalizeGuildFaction(report.guild?.faction)
  const guildTextClass = resolveGuildTextClass(guildFaction)
  const guildEntityPath = buildGuildEntityPath(report)
  const bossLabel = `${bossKillCount} ${bossKillCount === 1 ? 'boss' : 'bosses'}`
  const playersLabel = `${playerCount} ${playerCount === 1 ? 'player' : 'players'}`
  const reportUrl = buildReportUrl(reportHost, reportId)

  return (
    <section aria-label="Report header">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1 text-sm">
            <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-semibold">{report.title}</span>
              {guildName ? (
                <span className="text-muted-foreground">|</span>
              ) : null}
              {guildName ? (
                guildEntityPath ? (
                  <Link
                    className={`font-medium underline ${guildTextClass}`}
                    state={{ host: reportHost }}
                    to={guildEntityPath}
                  >
                    {`<${guildName}>`}
                  </Link>
                ) : (
                  <span className={`font-medium ${guildTextClass}`}>
                    {`<${guildName}>`}
                  </span>
                )
              ) : null}
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">{report.zone?.name}</span>
              <ReportStarButton
                ariaLabel={`${isStarred ? 'Unstar' : 'Star'} report ${report.title || reportId}`}
                className="ml-1"
                isDisabled={isStarToggleDisabled}
                isStarred={isStarred}
                onToggle={onToggleStar}
              />
            </CardTitle>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{formatReportHeaderDate(report.startTime)}</span>
              <span>|</span>
              <span>{bossLabel}</span>
              <span>|</span>
              <span>{playersLabel}</span>
              <span>|</span>
              <a
                aria-label="Open report on Warcraft Logs"
                className="inline-flex items-center gap-1 leading-none hover:opacity-80"
                href={reportUrl}
                rel="noreferrer"
                target="_blank"
                title="Open report on Warcraft Logs"
              >
                <span className="text-[10px] font-medium tracking-wide">
                  WCL
                </span>
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            <p>Threat config: {threatConfigLabel}</p>
          </div>
        </CardHeader>
      </Card>
    </section>
  )
}
