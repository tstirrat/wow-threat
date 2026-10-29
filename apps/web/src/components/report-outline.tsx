/**
 * Rail "This report" section: report metadata header and boss pull list (kills and wipes).
 */
import type { ThreatConfigId } from '@wow-threat/config'
import { ExternalLink } from 'lucide-react'
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import {
  buildBossKillNavigationFights,
  buildBossPullNavigationFights,
  buildFightLinkPath,
  resolveFightBossTargets,
  resolveWipeBossPercentage,
} from '../lib/fight-navigation'
import { formatReportHeaderDate } from '../lib/format'
import {
  type ReportGuildFaction,
  normalizeGuildFaction,
} from '../lib/guild-faction'
import { buildReportUrl } from '../lib/wcl-url'
import type {
  ReportActorSummary,
  ReportFightSummary,
  ReportResponse,
} from '../types/api'
import type { WarcraftLogsHost } from '../types/app'
import { ReportStarButton } from './report-star-button'
import { Skeleton } from './ui/skeleton'

export type ReportOutlineProps = {
  report: ReportResponse
  reportId: string
  reportHost: WarcraftLogsHost
  threatConfigLabel: string
  selectedFightId?: number | null
  configId?: ThreatConfigId | null
  eventsMode?: string | null
  forceFresh?: boolean
  pinnedPlayerIds?: number[]
  isStarred: boolean
  onToggleStar: () => void
  isStarToggleDisabled?: boolean
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

type ReportOutlineHeaderProps = Omit<
  ReportOutlineProps,
  'configId' | 'eventsMode' | 'forceFresh' | 'pinnedPlayerIds'
>

/** Report title, star, guild, zone, date, counts, WCL link and threat config. */
const ReportOutlineHeader: FC<ReportOutlineHeaderProps> = ({
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
  const guildTextClass = resolveGuildTextClass(
    normalizeGuildFaction(report.guild?.faction),
  )
  const guildEntityPath = buildGuildEntityPath(report)
  const bossLabel = `${bossKillCount} ${bossKillCount === 1 ? 'boss' : 'bosses'}`
  const playersLabel = `${playerCount} ${playerCount === 1 ? 'player' : 'players'}`

  return (
    <section
      aria-label="Report header"
      className="space-y-1 border-b border-border p-3 text-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-sm font-semibold break-words">
          {report.title}
        </h2>
        <ReportStarButton
          ariaLabel={`${isStarred ? 'Unstar' : 'Star'} report ${report.title || reportId}`}
          isDisabled={isStarToggleDisabled}
          isStarred={isStarred}
          onToggle={onToggleStar}
        />
      </div>
      {guildName ? (
        guildEntityPath ? (
          <Link
            className={`block font-medium hover:underline ${guildTextClass}`}
            state={{ host: reportHost }}
            to={guildEntityPath}
          >
            {`<${guildName}>`}
          </Link>
        ) : (
          <span className={`block font-medium ${guildTextClass}`}>
            {`<${guildName}>`}
          </span>
        )
      ) : null}
      {report.zone?.name ? (
        <p className="text-muted-foreground">{report.zone.name}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
        <span className="basis-full">
          {formatReportHeaderDate(report.startTime)}
        </span>
        <span>{bossLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{playersLabel}</span>
        <span aria-hidden="true">·</span>
        <a
          aria-label="Open report on Warcraft Logs"
          className="inline-flex items-center gap-1 leading-none hover:opacity-80"
          href={buildReportUrl(reportHost, reportId)}
          rel="noreferrer"
          target="_blank"
          title="Open report on Warcraft Logs"
        >
          <span className="text-[10px] font-medium tracking-wide">WCL</span>
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Threat config: {threatConfigLabel}
      </p>
    </section>
  )
}

/** Format boss health remaining for a wipe label. */
function formatWipePercentage(percentage: number): string {
  return `${Number(percentage.toFixed(1))}%`
}

type PullListProps = {
  fights: ReportFightSummary[]
  actors: ReportActorSummary[]
  reportId: string
  selectedFightId: number | null
  configId: ThreatConfigId | null
  eventsMode: string | null
  forceFresh: boolean
  pinnedPlayerIds: number[]
}

/** Boss pull links (kills and wipes) in report order with the current fight highlighted. */
const PullList: FC<PullListProps> = ({
  fights,
  actors,
  reportId,
  selectedFightId,
  configId,
  eventsMode,
  forceFresh,
  pinnedPlayerIds,
}) => {
  const bossPullFights = buildBossPullNavigationFights(fights)

  return (
    <nav aria-label="Fight quick switch" className="p-2">
      {bossPullFights.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {bossPullFights.map((fight) => {
            const isCurrentFight = fight.id === selectedFightId
            const wipePercentage = resolveWipeBossPercentage(fight)
            const bossTargets = isCurrentFight
              ? resolveFightBossTargets(fight, actors)
              : []

            return (
              <li key={fight.id}>
                <Link
                  aria-current={isCurrentFight ? 'page' : undefined}
                  className={[
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isCurrentFight
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-foreground/70 hover:bg-muted/60 hover:text-foreground',
                  ].join(' ')}
                  to={buildFightLinkPath({
                    reportId,
                    fightId: fight.id,
                    configId,
                    eventsMode,
                    forceFresh,
                    pinnedPlayerIds,
                  })}
                >
                  {fight.name}
                  {fight.kill ? null : (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {' '}
                      Wipe
                      {wipePercentage === null
                        ? ''
                        : ` ${formatWipePercentage(wipePercentage)}`}
                    </span>
                  )}
                </Link>
                {bossTargets.length > 0 ? (
                  <ul
                    aria-label={`${fight.name} boss targets`}
                    className="ml-4 list-disc py-0.5 pl-3 text-xs"
                  >
                    {bossTargets.map((target) => (
                      <li key={target.id}>
                        <Link
                          className="text-muted-foreground transition-colors hover:text-foreground"
                          to={buildFightLinkPath({
                            reportId,
                            fightId: fight.id,
                            configId,
                            eventsMode,
                            forceFresh,
                            pinnedPlayerIds,
                            targetId: target.id,
                          })}
                        >
                          {target.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          No boss fights found in this report.
        </p>
      )}
    </nav>
  )
}

/** Render the rail "This report" section. */
export const ReportOutline: FC<ReportOutlineProps> = ({
  configId = null,
  eventsMode = null,
  forceFresh = false,
  pinnedPlayerIds = [],
  ...headerProps
}) => {
  return (
    <div>
      <ReportOutlineHeader {...headerProps} />
      <PullList
        configId={configId}
        eventsMode={eventsMode}
        actors={headerProps.report.actors}
        fights={headerProps.report.fights}
        forceFresh={forceFresh}
        pinnedPlayerIds={pinnedPlayerIds}
        reportId={headerProps.reportId}
        selectedFightId={headerProps.selectedFightId ?? null}
      />
    </div>
  )
}

/** Render a rail-sized skeleton while report metadata is loading. */
export const ReportOutlineSkeleton: FC = () => {
  return (
    <div
      aria-label="Loading report header"
      aria-live="polite"
      className="space-y-3 border-b border-border p-3"
      data-testid="report-outline-skeleton"
      role="status"
    >
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}
