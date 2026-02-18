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
}

/** Render boss-kill quick links in report order. */
export const FightQuickSwitcher: FC<FightQuickSwitcherProps> = ({
  reportId,
  fights,
  selectedFightId,
}) => {
  const bossKillFights = buildBossKillNavigationFights(fights)

  return (
    <nav aria-label="Fight quick switch">
      {bossKillFights.length > 0 ? (
        <div className="flex w-full gap-1 overflow-x-auto">
          {bossKillFights.map((fight) => {
            const isCurrentFight = fight.id === selectedFightId

            return (
              <Link
                className={[
                  'rounded-md border border-transparent px-3 py-1.5 text-sm whitespace-nowrap transition-all',
                  isCurrentFight
                    ? 'bg-background text-foreground dark:border-input dark:bg-input/30'
                    : 'text-foreground/60 hover:text-foreground',
                ].join(' ')}
                key={fight.id}
                to={`/report/${reportId}/fight/${fight.id}`}
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
