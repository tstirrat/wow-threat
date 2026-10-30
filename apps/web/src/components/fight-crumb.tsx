/**
 * Report and fight crumbs for the app bar title: guild, report name with WCL link and star, then a fight pull menu.
 */
import type { ThreatConfigId } from '@wow-threat/config'
import { ChevronDown, ExternalLink } from 'lucide-react'
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import {
  buildBossPullNavigationFights,
  buildFightLinkPath,
  formatWipePercentage,
  resolveWipeBossPercentage,
} from '../lib/fight-navigation'
import {
  type ReportGuildFaction,
  resolveTitleRowClass,
} from '../lib/guild-faction'
import type { ReportFightSummary } from '../types/api'
import type { WarcraftLogsHost } from '../types/app'
import { ReportStarButton } from './report-star-button'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

const crumbSeparator = (
  <span aria-hidden="true" className="shrink-0 px-1 text-muted-foreground">
    ›
  </span>
)

export type ReportCrumbProps = {
  reportId: string
  reportTitle: string
  warcraftLogsUrl: string
  reportHost: WarcraftLogsHost
  guildName?: string | null
  guildFaction?: ReportGuildFaction
  guildPath?: string | null
  isStarred: boolean
  isStarToggleDisabled?: boolean
  onToggleStar: () => void
}

/** First crumb to truncate (and hidden below 1100px): the rail already shows the report. Carries its trailing separator. */
export const ReportCrumb: FC<ReportCrumbProps> = ({
  reportId,
  reportTitle,
  warcraftLogsUrl,
  reportHost,
  guildName = null,
  guildFaction = null,
  guildPath = null,
  isStarred,
  isStarToggleDisabled = false,
  onToggleStar,
}) => {
  const guildClassName = `shrink-0 font-medium ${resolveTitleRowClass(guildFaction)}`
  const guildLabel = guildName ? `<${guildName}>` : null

  return (
    <span
      className="flex min-w-0 shrink-[100] items-center gap-2 overflow-hidden max-[1100px]:hidden"
      data-testid="report-crumb"
    >
      {guildLabel ? (
        guildPath ? (
          <Link
            className={`${guildClassName} hover:underline`}
            state={{ host: reportHost }}
            to={guildPath}
          >
            {guildLabel}
          </Link>
        ) : (
          <span className={guildClassName}>{guildLabel}</span>
        )
      ) : null}
      <span className="min-w-0 truncate text-muted-foreground">
        {reportTitle}
      </span>
      <ReportStarButton
        ariaLabel={`${isStarred ? 'Unstar' : 'Star'} report ${reportTitle || reportId}`}
        className="-mr-1 -ml-1 shrink-0"
        isDisabled={isStarToggleDisabled}
        isStarred={isStarred}
        size="icon-xs"
        onToggle={onToggleStar}
      />
      <a
        aria-label="Open report on Warcraft Logs"
        className="inline-flex shrink-0 items-center gap-1 text-[10px] leading-none font-medium tracking-wide hover:opacity-80"
        href={warcraftLogsUrl}
        rel="noreferrer"
        target="_blank"
        title="Open report on Warcraft Logs"
      >
        WCL
        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
      </a>
      {crumbSeparator}
    </span>
  )
}

export type FightCrumbProps = {
  reportId: string
  fights: ReportFightSummary[]
  selectedFightId: number
  /** Full label, e.g. "Patchwerk · Kill · 2:00". */
  fightLabel: string
  /** Short label shown when space is tight. */
  fightShortLabel: string
  configId?: ThreatConfigId | null
  eventsMode?: string | null
  forceFresh?: boolean
  pinnedPlayerIds?: number[]
}

/** Crumb-styled menu button listing the report's boss kills; navigates keeping the current query params. */
export const FightCrumb: FC<FightCrumbProps> = ({
  reportId,
  fights,
  selectedFightId,
  fightLabel,
  fightShortLabel,
  configId = null,
  eventsMode = null,
  forceFresh = false,
  pinnedPlayerIds = [],
}) => {
  const bossPulls = buildBossPullNavigationFights(fights)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Fight: ${fightLabel}`}
          className="h-8 min-w-0 shrink-[3] justify-start max-[760px]:order-3 max-[760px]:flex-1 gap-1 px-1 text-sm font-medium text-foreground"
          type="button"
          variant="ghost"
        >
          <span className="truncate min-[1100px]:hidden">
            {fightShortLabel}
          </span>
          <span className="truncate max-[1100px]:hidden">{fightLabel}</span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 min-w-48">
        {bossPulls.map((fight) => {
          const wipePercentage = resolveWipeBossPercentage(fight)

          return (
            <DropdownMenuItem asChild key={fight.id}>
              <Link
                aria-current={fight.id === selectedFightId ? 'page' : undefined}
                className={fight.id === selectedFightId ? 'font-medium' : ''}
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
                    Wipe
                    {wipePercentage === null
                      ? ''
                      : ` ${formatWipePercentage(wipePercentage)}`}
                  </span>
                )}
              </Link>
            </DropdownMenuItem>
          )
        })}
        {bossPulls.length === 0 ? (
          <DropdownMenuItem disabled>
            No boss fights in this report
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
