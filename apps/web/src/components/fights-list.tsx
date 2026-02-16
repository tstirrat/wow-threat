/**
 * Fight navigation list for report-level route.
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import { buildBossKillNavigationFights } from '../lib/fight-navigation'
import type { ReportFightSummary } from '../types/api'

export type FightsListProps = {
  reportId: string
  fights: ReportFightSummary[]
}

const formatFightDuration = (fight: ReportFightSummary): string => {
  const durationMs = Math.max(0, fight.endTime - fight.startTime)
  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export const FightsList: FC<FightsListProps> = ({ reportId, fights }) => {
  if (fights.length === 0) {
    return <p className="text-sm text-muted">No fights found in this report.</p>
  }

  const bossKillFights = buildBossKillNavigationFights(fights)

  return (
    <div className="space-y-2">
      {bossKillFights.length > 0 ? (
        <ul aria-label="Boss kill fights" className="space-y-2">
          {bossKillFights.map((fight) => (
            <li
              className="rounded-md border border-border bg-panel px-3 py-3"
              key={fight.id}
            >
              <div className="flex flex-wrap items-center gap-1 text-sm">
                <span className="font-medium">{fight.name}</span>
                <span>:</span>
                <Link
                  className="underline"
                  to={`/report/${reportId}/fight/${fight.id}`}
                >
                  Kill ({formatFightDuration(fight)})
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          No boss kills found in this report.
        </p>
      )}
    </div>
  )
}
