/**
 * Summary table for focused/selected player rows.
 */
import { formatNumber } from '../lib/format'
import type { PlayerSummaryRow } from '../types/app'
import { PlayerName } from './player-name'

export function PlayerSummaryTable({
  rows,
}: {
  rows: PlayerSummaryRow[]
}): JSX.Element {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">Select or focus a player to view summary.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-2 py-2">Player</th>
            <th className="px-2 py-2">Total Threat</th>
            <th className="px-2 py-2">Total Damage</th>
            <th className="px-2 py-2">Total Healing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-border" key={row.actorId}>
              <td className="px-2 py-2">
                <PlayerName color={row.color} label={row.label} />
              </td>
              <td className="px-2 py-2">{formatNumber(row.totalThreat)}</td>
              <td className="px-2 py-2">{formatNumber(row.totalDamage)}</td>
              <td className="px-2 py-2">{formatNumber(row.totalHealing)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
