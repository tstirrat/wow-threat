/**
 * Player-focused navigation links from report view to fight pages.
 */
import type { PlayerClass } from '@wcl-threat/wcl-types'
import { Link } from 'react-router-dom'

import { getClassColor } from '../lib/class-colors'
import type { ReportActorSummary, ReportFightSummary } from '../types/api'

export function PlayersNavigationList({
  reportId,
  players,
  fights,
}: {
  reportId: string
  players: ReportActorSummary[]
  fights: ReportFightSummary[]
}): JSX.Element {
  if (players.length === 0) {
    return <p className="text-sm text-muted">No players detected in this report.</p>
  }

  return (
    <ul className="space-y-3">
      {players.map((player) => {
        const classColor = getClassColor(player.subType as PlayerClass | undefined)
        const playerFights = fights.filter((fight) => fight.friendlyPlayers.includes(player.id))

        return (
          <li className="rounded-md border border-border bg-panel p-3" key={player.id}>
            <p className="font-medium" style={{ color: classColor }}>
              {player.name}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {playerFights.map((fight) => (
                <Link
                  className="rounded border border-border px-2 py-1 text-xs underline"
                  key={fight.id}
                  to={`/report/${reportId}/fight/${fight.id}?players=${player.id}`}
                >
                  #{fight.id} {fight.name}
                </Link>
              ))}
              {playerFights.length === 0 ? (
                <span className="text-xs text-muted">No fights found for this player.</span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
