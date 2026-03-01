/**
 * Compact fight quick-switch navigation shared by report and fight routes.
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import { buildBossKillNavigationFights } from '../lib/fight-navigation'
import type { ReportFightSummary } from '../types/api'

export type FightQuickSwitcherProps = {
  reportId: string
  fights: ReportFightSummary[]
  selectedFightId: number | null
  pinnedPlayerIds?: number[]
}

/** Render boss-kill quick links in report order. */
export const FightQuickSwitcher: FC<FightQuickSwitcherProps> = ({
  reportId,
  fights,
  selectedFightId,
  pinnedPlayerIds = [],
}) => {
  const bossKillFights = buildBossKillNavigationFights(fights)
  const pinnedPlayers = [...new Set(pinnedPlayerIds)].sort(
    (left, right) => left - right,
  )

  return (
    <nav aria-label="Fight quick switch">
      {bossKillFights.length > 0 ? (
        <div className="flex w-full gap-1 overflow-x-auto">
          {bossKillFights.map((fight) => {
            const isCurrentFight = fight.id === selectedFightId
            const searchParams = new URLSearchParams()
            if (pinnedPlayers.length > 0) {
              const pinnedPlayerParam = pinnedPlayers.join(',')
              searchParams.set('pinnedPlayers', pinnedPlayerParam)
              searchParams.set('players', pinnedPlayerParam)
            }
            const search = searchParams.toString()

            return (
              <Link
                className={[
                  'rounded-md border border-transparent px-3 py-1.5 text-sm whitespace-nowrap transition-all',
                  isCurrentFight
                    ? 'bg-background text-foreground dark:border-input dark:bg-input/30'
                    : 'text-foreground/60 hover:text-foreground',
                ].join(' ')}
                key={fight.id}
                to={`/report/${reportId}/fight/${fight.id}${search.length > 0 ? `?${search}` : ''}`}
              >
                {fight.name}
              </Link>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No boss kills found in this report.
        </p>
      )}
    </nav>
  )
}
