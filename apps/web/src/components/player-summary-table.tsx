/**
 * Focused player metadata and per-ability threat breakdown table.
 */
import { ExternalLink } from 'lucide-react'
import type { CSSProperties, FC } from 'react'

import {
  healTextColor,
  threatStateTextColorByKind,
} from '../lib/data-text-colors'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

export type PlayerSummaryTableProps = {
  summary: FocusedPlayerSummary | null
  rows: FocusedPlayerThreatRow[]
  initialAuras: InitialAuraDisplay[]
  wowhead: WowheadLinksConfig
  warcraftLogsUrl?: string | null
}

const modifierValueTolerance = 0.0005
const fixateRowColor = threatStateTextColorByKind.fixate

function buildWowheadSpellUrl(wowheadDomain: string, spellId: number): string {
  return `https://www.wowhead.com/${wowheadDomain}/spell=${spellId}`
}

function formatTps(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)
}

function formatThreatValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)
}

function formatModifierValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)
}

function formatSignedModifierBonus(value: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Math.abs(value))

  return `${value >= 0 ? '+' : '-'}${formatted}`
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

function resolveModifierSchoolColor(schoolLabels: string[]): string | null {
  const normalizedLabels = schoolLabels
    .map((label) => label.trim().toLowerCase())
    .filter(Boolean)

  if (normalizedLabels.length === 0) {
    return null
  }

  if (normalizedLabels.length === 1 && normalizedLabels[0] === 'physical') {
    return null
  }

  return resolvePrimarySchoolColor(normalizedLabels)
}

function resolveModifierTotalColor(
  spellSchool: string | null | undefined,
): string | null {
  if (!spellSchool) {
    return null
  }

  const normalizedSchool = spellSchool.trim().toLowerCase()
  if (!normalizedSchool || normalizedSchool === 'physical') {
    return null
  }

  return resolveSchoolColor(normalizedSchool)
}

function isResourceRow(row: FocusedPlayerThreatRow): boolean {
  return row.key.endsWith(':resourcechange') || row.key.endsWith(':energize')
}

function resolveThreatRowColor(row: FocusedPlayerThreatRow): string | null {
  if (row.isFixate) {
    return fixateRowColor
  }

  if (row.isHeal) {
    return healTextColor
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

function formatFocusedActorDetails(summary: FocusedPlayerSummary): string {
  const classLabel = summary.actorClass ?? 'Unknown'
  const specClassLabel = summary.actorSpec
    ? `${summary.actorSpec} ${classLabel}`
    : classLabel
  const talentLabel = summary.talentPoints
    ? ` (${summary.talentPoints[0]}/${summary.talentPoints[1]}/${summary.talentPoints[2]})`
    : ''

  return `${specClassLabel}${talentLabel}`
}

export const PlayerSummaryTable: FC<PlayerSummaryTableProps> = ({
  summary,
  rows,
  initialAuras,
  wowhead,
  warcraftLogsUrl = null,
}) => {
  if (!summary) {
    return (
      <p aria-live="polite" className="p-3 text-xs text-muted-foreground">
        Click a chart line to focus an actor.
      </p>
    )
  }

  const totalAmount = summary.totalDamage + summary.totalHealing

  return (
    <div className="grid md:grid-cols-[17rem_minmax(0,1fr)]">
      <div className="space-y-3 p-3 max-md:border-b max-md:border-border md:border-r md:border-border">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <PlayerName color={summary.color} label={summary.label} />
            {warcraftLogsUrl ? (
              <a
                aria-label={`Open ${summary.label} on Warcraft Logs`}
                className="inline-flex items-center gap-1 text-[10px] font-medium leading-none text-muted-foreground hover:text-foreground"
                href={warcraftLogsUrl}
                rel="noopener noreferrer"
                target="_blank"
                title={`Open ${summary.label} on Warcraft Logs`}
              >
                <span>WCL</span>
                <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatFocusedActorDetails(summary)}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <SummaryMetric
            label="Total threat"
            value={formatNumber(summary.totalThreat)}
          />
          <SummaryMetric
            label="Total TPS"
            value={formatTps(summary.totalTps)}
          />
          <SummaryMetric
            label="Total damage"
            value={formatNumber(summary.totalDamage)}
          />
          <SummaryMetric
            label="Total healing"
            value={formatNumber(summary.totalHealing)}
          />
        </dl>
        <FocusedActorModifiers
          modifiers={summary.modifiers}
          wowhead={wowhead}
        />
        <InitialAuras auras={initialAuras} wowhead={wowhead} />
      </div>

      <div className="min-w-0">
        {rows.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            No threat-generating abilities for this actor in the current chart
            window.
          </p>
        ) : (
          <TooltipProvider delayDuration={0}>
            <Table
              aria-label="Focused player threat breakdown"
              className="text-xs [&_td:first-child]:pl-3 [&_td:last-child]:pr-3 [&_th:first-child]:pl-3 [&_th:last-child]:pr-3"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Ability / Debuff</TableHead>
                  <TableHead className="text-right">
                    Damage/Heal (Amount)
                  </TableHead>
                  <TableHead className="text-right">Threat</TableHead>
                  <TableHead className="text-right">Modifier</TableHead>
                  <TableHead className="text-right">TPS</TableHead>
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
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatThreatValue(row.threat)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <ModifierCell row={row} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.tps === null ? null : formatTps(row.tps)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(totalAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatThreatValue(summary.totalThreat)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    -
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatTps(summary.totalTps)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
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
      <div className="text-[11px] text-muted-foreground">Modifiers</div>
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
            const schoolColor = resolveModifierSchoolColor(
              modifier.schoolLabels,
            )
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
  const spellModifier = row.spellModifier
  const spellModifierMultiplier = spellModifier?.value ?? 1
  const spellModifierBonus = spellModifier?.bonus ?? 0
  const hasVisibleSpellMultiplier =
    spellModifier !== undefined &&
    Math.abs(spellModifierMultiplier - 1) > modifierValueTolerance
  const hasVisibleSpellBonus =
    spellModifier !== undefined &&
    Math.abs(spellModifierBonus) > modifierValueTolerance
  const hasFlatBonusOnlySpellModifier =
    spellModifier !== undefined &&
    Math.abs(spellModifierMultiplier) <= modifierValueTolerance &&
    hasVisibleSpellBonus
  const hasAnyModifierDetails =
    visibleModifiers.length > 0 ||
    hasVisibleSpellMultiplier ||
    hasVisibleSpellBonus ||
    Boolean(row.note)

  if (!hasAnyModifierDetails) {
    return <span className="text-muted-foreground">-</span>
  }

  const abilitySchoolLabel = formatAbilitySchoolLabel(row.spellSchool)
  const abilitySchoolColor = resolveModifierTotalColor(row.spellSchool ?? null)
  const hasVisibleTotalMultiplier =
    Math.abs(row.modifierTotal - 1) > modifierValueTolerance
  const spellModifierValueLabel =
    spellModifier && (hasVisibleSpellMultiplier || hasVisibleSpellBonus)
      ? hasVisibleSpellBonus
        ? `(${formatSignedModifierBonus(spellModifierBonus)}) x${formatModifierValue(spellModifierMultiplier)}`
        : `x${formatModifierValue(spellModifierMultiplier)}`
      : null
  const hasMultiplierDetails =
    Boolean(spellModifierValueLabel) || visibleModifiers.length > 0
  const multiplierDetailRowCount =
    visibleModifiers.length + (spellModifierValueLabel ? 1 : 0)
  const renderTotalAfterDetails = multiplierDetailRowCount > 1
  const shouldShowUnityTotalLabel =
    !hasVisibleTotalMultiplier && hasMultiplierDetails
  const primaryLabel = hasFlatBonusOnlySpellModifier
    ? `${formatSignedModifierBonus(spellModifierBonus)}*`
    : hasVisibleTotalMultiplier || shouldShowUnityTotalLabel
      ? `x${formatModifierValue(row.modifierTotal)}${hasVisibleSpellBonus ? '*' : ''}`
      : hasVisibleSpellBonus
        ? '*'
        : row.note
          ? 'note'
          : '-'
  const spellModifierLabel = row.isHeal ? 'Heal' : row.abilityName

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="cursor-help underline decoration-dotted underline-offset-2"
          type="button"
        >
          {primaryLabel}
        </button>
      </TooltipTrigger>
      <TooltipContent
        align="center"
        className="w-60 max-w-none rounded-md border border-border bg-popover p-2 text-left text-xs text-popover-foreground shadow-md"
        side="top"
        sideOffset={8}
      >
        <div className="text-left font-medium">Modifier breakdown</div>
        {row.spellSchool ? (
          <div className="mb-1 text-[11px] text-muted-foreground">
            <span>Ability school: </span>
            <span
              style={
                abilitySchoolColor ? { color: abilitySchoolColor } : undefined
              }
            >
              {abilitySchoolLabel}
            </span>
          </div>
        ) : null}
        {hasMultiplierDetails ? (
          <div className="space-y-1">
            <div className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">
              Multipliers
            </div>
            {!renderTotalAfterDetails ? (
              <div className="flex items-center justify-between gap-2">
                <span>Total</span>
                <span>x{formatModifierValue(row.modifierTotal)}</span>
              </div>
            ) : null}
            {spellModifierValueLabel ? (
              <div className="flex items-center justify-between gap-2">
                <span>{spellModifierLabel}</span>
                <span>{spellModifierValueLabel}</span>
              </div>
            ) : null}
            {visibleModifiers.map((modifier, index) => {
              const modifierSchoolsLabel = resolveModifierSchoolsLabel(
                modifier.schoolLabels,
              )
              const schoolColor = resolveModifierSchoolColor(
                modifier.schoolLabels,
              )

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
            {renderTotalAfterDetails ? (
              <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/60 pt-1">
                <span>Total</span>
                <span>x{formatModifierValue(row.modifierTotal)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        {row.note ? (
          <div className="mt-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Note
            </span>
            <div>{row.note}</div>
          </div>
        ) : null}
      </TooltipContent>
    </Tooltip>
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
