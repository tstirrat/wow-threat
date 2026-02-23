/**
 * Threat chart tooltip formatter and tooltip-specific helpers.
 */
import { ResourceTypeCode } from '@wow-threat/wcl-types'
import { renderToString } from 'react-dom/server'

import type { ThreatChartThemeColors } from '../hooks/use-threat-chart-theme-colors'
import type { ThreatSeries } from '../types/app'
import { formatTimelineTime } from './format'
import {
  resolveSpellSchoolColor,
  resolveSpellSchoolColorFromLabels,
} from './spell-school-colors'
import type { TooltipPointPayload } from './threat-chart-types'
import { resolveThreatStateStatus } from './threat-chart-visuals'

export const bossMeleeMarkerColor = '#ef4444'
export const deathMarkerColor = '#dc2626'

function formatThreatNumber(value: number): string {
  if (value < 0) {
    return `-${formatTooltipNumber(Math.abs(value))}`
  }

  return formatTooltipNumber(value)
}

function formatTooltipNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatResourceTypeLabel(resourceType: number | null): string | null {
  const byResourceTypeCode: Record<number, string> = {
    [ResourceTypeCode.Mana]: 'Mana',
    [ResourceTypeCode.Rage]: 'Rage',
    [ResourceTypeCode.Focus]: 'Focus',
    [ResourceTypeCode.Energy]: 'Energy',
    [ResourceTypeCode.ComboPoints]: 'Combo points',
    [ResourceTypeCode.RunicPower]: 'Runic power',
    [ResourceTypeCode.HolyPower]: 'Holy power',
  }

  if (resourceType === null) {
    return null
  }

  return byResourceTypeCode[resourceType] ?? `Resource (${resourceType})`
}

function resolveSplitCount(
  modifiedThreat: number,
  threatDelta: number,
): number {
  if (modifiedThreat === 0 || threatDelta === 0) {
    return 1
  }

  const ratio = Math.abs(modifiedThreat / threatDelta)
  const rounded = Math.round(ratio)
  if (!Number.isFinite(ratio) || rounded <= 1) {
    return 1
  }

  return Math.abs(ratio - rounded) < 0.001 ? rounded : 1
}

const hitTypeLabelByCode: Record<number, string> = {
  0: 'miss',
  1: 'hit',
  2: 'crit',
  3: 'absorb',
  4: 'block',
  5: 'crit block',
  6: 'glancing',
  7: 'dodge',
  8: 'parry',
  10: 'immune',
  14: 'resist',
  15: 'crushing',
  16: 'partial resist',
  17: 'crit (partial resist)',
}

function resolveTooltipHitTypeLabel(
  hitType: TooltipPointPayload['hitType'] | null | undefined,
): string | null {
  if (hitType === null || hitType === undefined) {
    return null
  }

  if (typeof hitType === 'string') {
    const normalized = hitType.toLowerCase()
    return normalized === 'hit' ? null : normalized
  }

  const normalized = hitTypeLabelByCode[hitType]
  if (!normalized || normalized === 'hit') {
    return null
  }

  return normalized
}

interface TooltipRenderData {
  abilityEventSuffix: string
  abilityName: string
  abilityTitleColor: string | null
  actorColor: string
  actorName: string
  amount: number
  amountColor: string | null
  amountLabel: string
  amountSchool: string
  auraLabel: string | null
  auraStatusColor: string | null
  markerKind: TooltipPointPayload['markerKind'] | null
  modifiersTotal: number
  modifiedThreat: number
  splitCount: number
  threatDelta: number
  timeMs: number
  totalThreat: number
  visibleModifiers: TooltipPointPayload['modifiers']
  hitTypeLabel: string | null
  formula: string
  mutedColor: string
  spellId: number | null
}

function formatThreatValue(data: TooltipRenderData): string {
  if (data.splitCount <= 1) {
    return formatThreatNumber(data.threatDelta)
  }

  return `${formatThreatNumber(data.modifiedThreat)} / ${data.splitCount} = ${formatThreatNumber(data.threatDelta)}`
}

function tooltipContent({ data }: { data: TooltipRenderData }): JSX.Element {
  const rowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    lineHeight: 1.2,
  } as const

  return (
    <div
      style={{
        minWidth: 280,
        fontSize: 12,
        lineHeight: 1.2,
      }}
    >
      <div style={rowStyle}>
        <strong
          style={
            data.abilityTitleColor
              ? { color: data.abilityTitleColor }
              : undefined
          }
        >
          {data.abilityName}
          {data.hitTypeLabel ? ` [${data.hitTypeLabel}]` : ''}
          {data.abilityEventSuffix}
        </strong>
        <strong style={{ color: data.actorColor }}>{data.actorName}</strong>
      </div>
      <div style={{ lineHeight: 1.2 }}>
        T: {formatTimelineTime(data.timeMs)}
      </div>
      <div
        style={{
          ...rowStyle,
          ...(data.amountColor ? { color: data.amountColor } : {}),
        }}
      >
        <span>
          {data.amountLabel}: {formatTooltipNumber(data.amount)}
          {data.amountSchool}
        </span>
        <span>{data.formula}</span>
      </div>
      {data.visibleModifiers.length > 0 ? (
        <>
          <div style={rowStyle}>
            <span>Multipliers:</span>
            <span>&sum; {formatTooltipNumber(data.modifiersTotal)}</span>
          </div>
          <div style={{ paddingLeft: '2ch' }}>
            {data.visibleModifiers.map((modifier, index) => {
              const schoolsLabel = modifier.schoolLabels.join('/')
              const rowColor = resolveSpellSchoolColorFromLabels(
                modifier.schoolLabels,
              )
              const value = Number.isFinite(modifier.value)
                ? formatTooltipNumber(modifier.value)
                : '-'

              return (
                <div
                  key={`${modifier.name}-${index}`}
                  style={{
                    ...rowStyle,
                    ...(rowColor ? { color: rowColor } : {}),
                  }}
                >
                  <span>
                    {modifier.name}
                    {schoolsLabel.length > 0 ? ` (${schoolsLabel})` : ''}
                  </span>
                  <span>{value}</span>
                </div>
              )
            })}
          </div>
        </>
      ) : null}
      <div style={rowStyle}>
        <span>Threat: {formatThreatValue(data)}</span>
        <span>&sum; {formatTooltipNumber(data.totalThreat)}</span>
      </div>
      {data.auraLabel && data.auraStatusColor ? (
        <div>
          Aura:{' '}
          <strong style={{ color: data.auraStatusColor }}>
            {data.auraLabel}
          </strong>
        </div>
      ) : null}
      {data.markerKind === 'bossMelee' ? (
        <div>
          Marker:{' '}
          <strong style={{ color: bossMeleeMarkerColor }}>Boss melee</strong>
        </div>
      ) : data.markerKind === 'death' ? (
        <div>
          Marker: <strong style={{ color: deathMarkerColor }}>Death</strong>
        </div>
      ) : null}
      {data.spellId ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginTop: 4,
            color: data.mutedColor,
            fontSize: 11,
          }}
        >
          ID: {data.spellId}
        </div>
      ) : null}
    </div>
  )
}

/** Build the single-point tooltip HTML formatter used by the threat chart. */
export function createThreatChartTooltipFormatter({
  series,
  themeColors,
}: {
  series: ThreatSeries[]
  themeColors: ThreatChartThemeColors
}): (params: unknown) => string {
  return (params: unknown): string => {
    const entry = params as {
      data?: TooltipPointPayload
      seriesName?: string
    }
    const payload = entry.data
    if (!payload) {
      return ''
    }

    const timeMs = Number(payload.timeMs ?? 0)
    const totalThreat = Number(payload.totalThreat ?? 0)
    const threatDelta = Number(payload.threatDelta ?? 0)
    const amount = Number(payload.amount ?? 0)
    const modifiedThreat = Number(payload.modifiedThreat ?? 0)
    const markerKind = payload.markerKind ?? null
    const spellSchool = payload.spellSchool?.toLowerCase() ?? null
    const rawEventType = String(payload.eventType ?? 'unknown').toLowerCase()
    const targetName =
      typeof payload.targetName === 'string' && payload.targetName.trim()
        ? payload.targetName.trim()
        : null
    const isTickEvent = payload.isTick === true
    const rawResourceType =
      typeof payload.resourceType === 'number' ? payload.resourceType : null
    const isHealEvent = rawEventType === 'heal'
    const isAbsorbedEvent = rawEventType === 'absorbed'
    const isResourceEvent =
      rawEventType === 'resourcechange' || rawEventType === 'energize'
    const abilityEventSuffix = isHealEvent
      ? `${targetName ? ` → ${targetName}` : ''} (${isTickEvent ? 'tick' : 'heal'})`
      : isAbsorbedEvent
        ? `${targetName ? ` @ ${targetName}` : ''} (absorbed)`
        : rawEventType === 'damage'
          ? isTickEvent
            ? ' (tick)'
            : ''
          : ` (${rawEventType})`
    const abilityTitleColor = isHealEvent ? '#22c55e' : null
    const actorId = Number(payload.actorId ?? 0)
    const sourceSeries = series.find((item) => item.actorId === actorId) ?? null
    const auraStatus = sourceSeries
      ? resolveThreatStateStatus(sourceSeries, timeMs)
      : { color: null, label: 'normal' }
    const splitCount = resolveSplitCount(modifiedThreat, threatDelta)
    const visibleModifiers = (payload.modifiers ?? []).filter(
      (modifier) =>
        Number.isFinite(modifier.value) &&
        Math.abs(modifier.value - 1) > 0.0005,
    )
    const modifiersTotal = visibleModifiers.reduce((total, modifier) => {
      if (!Number.isFinite(modifier.value)) {
        return total
      }

      return total * modifier.value
    }, 1)
    const isSchoolAmountEvent =
      rawEventType === 'damage' || rawEventType === 'heal'
    const amountSchool =
      isSchoolAmountEvent && spellSchool && spellSchool !== 'physical'
        ? ` (${spellSchool})`
        : ''
    const amountColor =
      rawEventType === 'heal'
        ? '#22c55e'
        : rawEventType === 'damage'
          ? resolveSpellSchoolColor(spellSchool)
          : null
    const amountLabel = isResourceEvent
      ? (formatResourceTypeLabel(rawResourceType) ?? 'Amt')
      : 'Amt'
    const hitTypeLabel = resolveTooltipHitTypeLabel(payload.hitType)
    const spellId =
      typeof payload.spellId === 'number' && payload.spellId > 0
        ? payload.spellId
        : null

    const html = renderToString(
      tooltipContent({
        data: {
          abilityEventSuffix,
          abilityName: payload.abilityName ?? 'Unknown ability',
          abilityTitleColor,
          actorColor: String(payload.actorColor ?? '#94a3b8'),
          actorName: String(entry.seriesName ?? 'Unknown actor'),
          amount,
          amountColor,
          amountLabel,
          amountSchool,
          auraLabel:
            auraStatus.color && auraStatus.label ? auraStatus.label : null,
          auraStatusColor: auraStatus.color ?? themeColors.muted,
          markerKind,
          modifiersTotal,
          modifiedThreat,
          splitCount,
          threatDelta,
          timeMs,
          totalThreat,
          visibleModifiers,
          hitTypeLabel,
          formula: payload.formula ?? 'n/a',
          mutedColor: themeColors.muted,
          spellId,
        },
      }),
    )

    return html.replaceAll('<!-- -->', '')
  }
}
