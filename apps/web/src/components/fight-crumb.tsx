/**
 * Report and fight crumbs for the app bar title: the report is plain text, the fight opens a boss-kill menu.
 */
import type { ThreatConfigId } from '@wow-threat/config'
import { ChevronDown } from 'lucide-react'
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import {
  buildBossKillNavigationFights,
  buildFightLinkPath,
} from '../lib/fight-navigation'
import type { ReportFightSummary } from '../types/api'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

const crumbSeparator = (
  <span aria-hidden="true" className="shrink-0 text-muted-foreground">
    ›
  </span>
)

export type ReportCrumbProps = {
  reportTitle: string
}

/** First crumb to truncate (and hidden below 1100px): the rail already shows the report. Carries its trailing separator. */
export const ReportCrumb: FC<ReportCrumbProps> = ({ reportTitle }) => (
  <span
    className="flex min-w-0 shrink-[100] items-center gap-2 overflow-hidden max-[1100px]:hidden"
    data-testid="report-crumb"
  >
    <span className="min-w-0 truncate text-muted-foreground">
      {reportTitle}
    </span>
    {crumbSeparator}
  </span>
)

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
  const bossKills = buildBossKillNavigationFights(fights)

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
        {bossKills.map((fight) => (
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
            </Link>
          </DropdownMenuItem>
        ))}
        {bossKills.length === 0 ? (
          <DropdownMenuItem disabled>
            No boss kills in this report
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
