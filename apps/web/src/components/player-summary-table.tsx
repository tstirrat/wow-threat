/**
 * Focused player metadata and per-ability threat breakdown table.
 */
import type { FC } from 'react'

import { formatNumber } from '../lib/format'
import type { FocusedPlayerSummary, FocusedPlayerThreatRow } from '../types/app'
import { PlayerName } from './player-name'

export type PlayerSummaryTableProps = {
  summary: FocusedPlayerSummary | null
  rows: FocusedPlayerThreatRow[]
}

function formatTps(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value)
}

export const PlayerSummaryTable: FC<PlayerSummaryTableProps> = ({
  summary,
  rows,
}) => {
  if (!summary) {
    return (
      <p aria-live="polite" className="text-sm text-muted">
        Click a chart line to focus a player.
      </p>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
      <div className="space-y-2 rounded-md border border-border bg-panel p-3">
        <div className="text-xs uppercase tracking-wide text-muted">Focused player</div>
        <div className="text-base">
          <PlayerName color={summary.color} label={summary.label} />
        </div>
        <div className="text-sm text-muted">Class: {summary.actorClass ?? 'Unknown'}</div>
        <div className="space-y-2 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Total threat</div>
            <div>{formatNumber(summary.totalThreat)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Total TPS</div>
            <div>{formatTps(summary.totalTps)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Total damage</div>
            <div>{formatNumber(summary.totalDamage)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Total healing</div>
            <div>{formatNumber(summary.totalHealing)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-panel p-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">
            No threat-generating abilities for this player in the current chart window.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              aria-label="Focused player threat breakdown"
              className="min-w-full border-collapse text-sm"
            >
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2">Ability / Debuff</th>
                  <th className="px-2 py-2">Damage/Heal (Amount)</th>
                  <th className="px-2 py-2">Threat</th>
                  <th className="px-2 py-2">TPS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-b border-border" key={row.key}>
                    <td className="px-2 py-2">{row.abilityName}</td>
                    <td className="px-2 py-2">{formatNumber(row.amount)}</td>
                    <td className="px-2 py-2">{formatNumber(row.threat)}</td>
                    <td className="px-2 py-2">{formatTps(row.tps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
