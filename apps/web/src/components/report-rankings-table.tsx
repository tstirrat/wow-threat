/**
 * Report-level aggregated player ranking table.
 */
import { formatNumber } from '../lib/format'
import type { ReportFightSummary } from '../types/api'
import type { ReportPlayerRanking } from '../lib/threat-aggregation'
import { PlayerName } from './player-name'

export function ReportRankingsTable({
  rankings,
  fights,
}: {
  rankings: ReportPlayerRanking[]
  fights: ReportFightSummary[]
}): JSX.Element {
  if (rankings.length === 0) {
    return <p className="text-sm text-muted">No ranking data available yet.</p>
  }

  const topFights = fights.slice(0, 6)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-2 py-2">Player</th>
            <th className="px-2 py-2">Total Threat</th>
            <th className="px-2 py-2">Fights</th>
            {topFights.map((fight) => (
              <th className="px-2 py-2" key={fight.id}>
                #{fight.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rankings.map((ranking) => (
            <tr className="border-b border-border" key={ranking.actorId}>
              <td className="px-2 py-2">
                <PlayerName color={ranking.color} label={ranking.actorName} />
              </td>
              <td className="px-2 py-2">{formatNumber(ranking.totalThreat)}</td>
              <td className="px-2 py-2">{ranking.fightCount}</td>
              {topFights.map((fight) => (
                <td className="px-2 py-2" key={fight.id}>
                  {formatNumber(ranking.perFight[fight.id] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
