/**
 * Focused player metadata and per-ability threat breakdown table.
 */
import type { CSSProperties, FC } from 'react'

import { formatNumber } from '../lib/format'
import type {
  FocusedPlayerSummary,
  FocusedPlayerThreatRow,
  InitialAuraDisplay,
  WowheadLinksConfig,
} from '../types/app'
import { InitialAuras } from './initial-auras'
import { PlayerName } from './player-name'
import { Card, CardContent } from './ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'

export type PlayerSummaryTableProps = {
  summary: FocusedPlayerSummary | null
  rows: FocusedPlayerThreatRow[]
  initialAuras: InitialAuraDisplay[]
  wowhead: WowheadLinksConfig
}

function buildWowheadSpellUrl(wowheadDomain: string, spellId: number): string {
  return `https://www.wowhead.com/${wowheadDomain}/spell=${spellId}`
}

function formatTps(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value)
}

const healAmountColor = '#22c55e'
const fixateRowColor = '#ffa500'

function resolveThreatRowColor(row: FocusedPlayerThreatRow): string | null {
  if (row.isFixate) {
    return fixateRowColor
  }

  if (row.isHeal) {
    return healAmountColor
  }

  return null
}

function resolveThreatRowStyle(
  row: FocusedPlayerThreatRow,
): CSSProperties | undefined {
  const color = resolveThreatRowColor(row)
  return color ? { color } : undefined
}

export const PlayerSummaryTable: FC<PlayerSummaryTableProps> = ({
  summary,
  rows,
  initialAuras,
  wowhead,
}) => {
  if (!summary) {
    return (
      <p aria-live="polite" className="text-sm text-muted-foreground">
        Click a chart line to focus an actor.
      </p>
    )
  }

  const totalAmount = summary.totalDamage + summary.totalHealing

  return (
    <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="bg-panel" size="sm">
        <CardContent className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-foreground">
            Focused actor
          </div>
          <div className="text-base">
            <PlayerName color={summary.color} label={summary.label} />
          </div>
          <div className="text-sm text-muted-foreground">
            Class: {summary.actorClass ?? 'Unknown'}
            {summary.talentPoints &&
              ` (${summary.talentPoints[0]}/${summary.talentPoints[1]}/${summary.talentPoints[2]})`}
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Total threat
              </div>
              <div>{formatNumber(summary.totalThreat)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Total TPS
              </div>
              <div>{formatTps(summary.totalTps)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Total damage
              </div>
              <div>{formatNumber(summary.totalDamage)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Total healing
              </div>
              <div>{formatNumber(summary.totalHealing)}</div>
            </div>
          </div>
          <InitialAuras auras={initialAuras} wowhead={wowhead} />
        </CardContent>
      </Card>

      <Card className="bg-panel" size="sm">
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No threat-generating abilities for this actor in the current chart
              window.
            </p>
          ) : (
            <Table
              aria-label="Focused player threat breakdown"
              className="text-sm"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Ability / Debuff</TableHead>
                  <TableHead>Damage/Heal (Amount)</TableHead>
                  <TableHead>Threat</TableHead>
                  <TableHead>TPS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key} style={resolveThreatRowStyle(row)}>
                    <TableCell>
                      {row.abilityId === null ? (
                        row.abilityName
                      ) : (
                        <WowHeadLink
                          abilityId={row.abilityId}
                          wowhead={wowhead}
                        >
                          {row.abilityName}
                        </WowHeadLink>
                      )}
                    </TableCell>
                    <TableCell>{formatNumber(row.amount)}</TableCell>
                    <TableCell>{formatNumber(row.threat)}</TableCell>
                    <TableCell>
                      {row.tps === null ? null : formatTps(row.tps)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell>{formatNumber(totalAmount)}</TableCell>
                  <TableCell>{formatNumber(summary.totalThreat)}</TableCell>
                  <TableCell>{formatTps(summary.totalTps)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function WowHeadLink({
  abilityId,
  wowhead,
  children,
  type = 'spell',
}: {
  abilityId: number
  wowhead: WowheadLinksConfig
  type?: 'spell' | 'item'
  children: React.ReactNode
}) {
  return (
    <a
      className="underline"
      data-wowhead={`${type}=${abilityId}&domain=${wowhead.domain}`}
      href={buildWowheadSpellUrl(wowhead.domain, abilityId)}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  )
}
