/**
 * Focused player metadata and per-ability threat breakdown table.
 */
import type { CSSProperties, FC } from 'react'

import { formatNumber } from '../lib/format'
import {
  resolveSpellSchoolColor,
  resolveSpellSchoolColorFromLabels,
} from '../lib/spell-school-colors'
import type {
  FocusedPlayerModifier,
  FocusedPlayerSummary,
  FocusedPlayerThreatRow,
  InitialAuraDisplay,
  ThreatPointModifier,
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

const modifierValueTolerance = 0.0005
const healAmountColor = '#22c55e'
const fixateRowColor = '#ffa500'

function buildWowheadSpellUrl(wowheadDomain: string, spellId: number): string {
  return `https://www.wowhead.com/${wowheadDomain}/spell=${spellId}`
}

function formatTps(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value)
}

function formatModifierValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)
}

function isVisibleModifier(modifier: ThreatPointModifier): boolean {
  return (
    Number.isFinite(modifier.value) &&
    Math.abs(modifier.value - 1) > modifierValueTolerance
  )
}

function resolveModifierSchoolsLabel(schoolLabels: string[]): string {
  return schoolLabels.join('/')
}

function resolveSchoolColor(school: string | null): string | null {
  return resolveSpellSchoolColor(school)
}

function resolvePrimarySchoolColor(schoolLabels: string[]): string | null {
  return resolveSpellSchoolColorFromLabels(schoolLabels)
}

function isResourceRow(row: FocusedPlayerThreatRow): boolean {
  return row.key.endsWith(':resourcechange') || row.key.endsWith(':energize')
}

function resolveThreatRowColor(row: FocusedPlayerThreatRow): string | null {
  if (row.isFixate) {
    return fixateRowColor
  }

  if (row.isHeal) {
    return healAmountColor
  }

  if (isResourceRow(row)) {
    return null
  }

  if (row.spellSchool?.toLowerCase() === 'physical') {
    return null
  }

  return resolveSchoolColor(row.spellSchool ?? null)
}

function resolveThreatRowStyle(
  row: FocusedPlayerThreatRow,
): CSSProperties | undefined {
  const color = resolveThreatRowColor(row)
  return color ? { color } : undefined
}

function formatAbilitySchoolLabel(
  spellSchool: string | null | undefined,
): string {
  if (!spellSchool) {
    return 'unknown'
  }

  return spellSchool.replaceAll('/', '')
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
          <FocusedActorModifiers
            modifiers={summary.modifiers}
            wowhead={wowhead}
          />
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
                  <TableHead>Modifier</TableHead>
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
                      <ModifierCell row={row} />
                    </TableCell>
                    <TableCell>
                      {row.tps === null ? null : formatTps(row.tps)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell>{formatNumber(totalAmount)}</TableCell>
                  <TableCell>{formatNumber(summary.totalThreat)}</TableCell>
                  <TableCell className="text-muted-foreground">-</TableCell>
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

function FocusedActorModifiers({
  modifiers,
  wowhead,
}: {
  modifiers: FocusedPlayerModifier[]
  wowhead: WowheadLinksConfig
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Modifiers
      </div>
      {modifiers.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          No applied modifiers found for this actor in the current fight.
        </p>
      ) : (
        <ul className="mt-1 space-y-1 text-xs">
          {modifiers.map((modifier) => {
            const schoolsLabel = resolveModifierSchoolsLabel(
              modifier.schoolLabels,
            )
            const schoolColor = resolvePrimarySchoolColor(modifier.schoolLabels)
            const modifierLabel = `${modifier.name}${schoolsLabel ? ` (${schoolsLabel})` : ''}`

            return (
              <li
                key={modifier.key}
                style={schoolColor ? { color: schoolColor } : undefined}
              >
                {modifier.spellId ? (
                  <WowHeadLink abilityId={modifier.spellId} wowhead={wowhead}>
                    {modifierLabel}
                  </WowHeadLink>
                ) : (
                  modifierLabel
                )}{' '}
                <span className="text-muted-foreground">
                  x{formatModifierValue(modifier.value)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ModifierCell({ row }: { row: FocusedPlayerThreatRow }) {
  const visibleModifiers = row.modifierBreakdown.filter((modifier) =>
    isVisibleModifier(modifier),
  )
  const healModifierColor = row.isHeal
    ? resolveSchoolColor(row.spellSchool ?? null)
    : null

  if (
    visibleModifiers.length === 0 ||
    Math.abs(row.modifierTotal - 1) <= modifierValueTolerance
  ) {
    return <span className="text-muted-foreground">-</span>
  }

  const abilitySchoolLabel = formatAbilitySchoolLabel(row.spellSchool)

  return (
    <div className="group relative inline-flex">
      <button
        className="cursor-help underline decoration-dotted underline-offset-2"
        style={healModifierColor ? { color: healModifierColor } : undefined}
        type="button"
      >
        x{formatModifierValue(row.modifierTotal)}
      </button>
      <div
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-md border border-border bg-popover p-2 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        role="tooltip"
      >
        <div className="font-medium">Modifier breakdown</div>
        {row.spellSchool ? (
          <div className="mb-1 text-[11px] text-muted-foreground">
            Ability school: {abilitySchoolLabel}
          </div>
        ) : null}
        <div className="space-y-1">
          {visibleModifiers.map((modifier, index) => {
            const modifierSchoolsLabel = resolveModifierSchoolsLabel(
              modifier.schoolLabels,
            )
            const schoolColor = resolvePrimarySchoolColor(modifier.schoolLabels)

            return (
              <div
                className="flex items-center justify-between gap-2"
                key={`${modifier.name}-${index}`}
                style={schoolColor ? { color: schoolColor } : undefined}
              >
                <span>
                  {modifier.name}
                  {modifierSchoolsLabel ? ` (${modifierSchoolsLabel})` : ''}
                </span>
                <span>x{formatModifierValue(modifier.value)}</span>
              </div>
            )
          })}
        </div>
      </div>
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
      className="no-underline hover:no-underline focus-visible:no-underline"
      data-wowhead={`${type}=${abilityId}&domain=${wowhead.domain}`}
      href={buildWowheadSpellUrl(wowhead.domain, abilityId)}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  )
}
