/**
 * Render-only tooltip content component for threat chart point details.
 */
import type { FC } from 'react'

import { formatTimelineTime } from '../lib/format'
import { resolveSpellSchoolColorFromLabels } from '../lib/spell-school-colors'
import {
  bossMeleeMarkerColor,
  deathMarkerColor,
  tranquilAirTotemMarkerColor,
} from '../lib/threat-chart-tooltip-colors'
import type { TooltipPointPayload } from '../lib/threat-chart-types'

export interface ThreatChartTooltipContentData {
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
  spellModifier?: TooltipPointPayload['spellModifier']
  spellModifierLabel?: string
  note?: string
  mutedColor: string
  spellId: number | null
}

export type ThreatChartTooltipContentProps = {
  data: ThreatChartTooltipContentData
}

function formatTooltipNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatThreatNumber(value: number): string {
  if (value < 0) {
    return `-${formatTooltipNumber(Math.abs(value))}`
  }

  return formatTooltipNumber(value)
}

function formatThreatValue(data: ThreatChartTooltipContentData): string {
  if (data.splitCount <= 1) {
    return formatThreatNumber(data.threatDelta)
  }

  return `${formatThreatNumber(data.modifiedThreat)} / ${data.splitCount} = ${formatThreatNumber(data.threatDelta)}`
}

function formatSignedModifierBonus(value: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Math.abs(value))

  return `${value >= 0 ? '+' : '-'}${formatted}`
}

/** Render the ECharts tooltip body for a single threat point. */
export const ThreatChartTooltipContent: FC<ThreatChartTooltipContentProps> = ({
  data,
}) => {
  const isBossDamageMarker = data.markerKind === 'bossMelee'
  const isDeathMarker = data.markerKind === 'death'
  const spellModifier = data.spellModifier
  const spellModifierMultiplier = spellModifier?.value ?? 1
  const spellModifierBonus = spellModifier?.bonus ?? 0
  const hasVisibleSpellMultiplier =
    spellModifier !== undefined &&
    Math.abs(spellModifierMultiplier - 1) > 0.0005
  const hasVisibleSpellBonus =
    spellModifier !== undefined && Math.abs(spellModifierBonus) > 0.0005
  const spellModifierValueLabel =
    spellModifier && (hasVisibleSpellMultiplier || hasVisibleSpellBonus)
      ? `${hasVisibleSpellBonus ? `(${formatSignedModifierBonus(spellModifierBonus)}) ` : ''}${formatTooltipNumber(spellModifierMultiplier)}`
      : null
  const hasVisibleMultipliers =
    data.visibleModifiers.length > 0 || Boolean(spellModifierValueLabel)
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
        {isDeathMarker ? (
          <strong style={{ color: data.actorColor }}>
            <span style={{ textDecoration: 'line-through' }}>
              {data.actorName}
            </span>{' '}
            <span>(death)</span>
          </strong>
        ) : (
          <>
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
          </>
        )}
      </div>
      <div style={{ lineHeight: 1.2 }}>
        T: {formatTimelineTime(data.timeMs)}
      </div>
      {!isDeathMarker ? (
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
          <span />
        </div>
      ) : null}
      {!isBossDamageMarker && !isDeathMarker && hasVisibleMultipliers ? (
        <>
          <div style={rowStyle}>
            <span>Multipliers:</span>
            <span>&sum; {formatTooltipNumber(data.modifiersTotal)}</span>
          </div>
          <div style={{ paddingLeft: '2ch' }}>
            {spellModifierValueLabel ? (
              <div style={rowStyle}>
                <span>{data.spellModifierLabel ?? data.abilityName}</span>
                <span>{spellModifierValueLabel}</span>
              </div>
            ) : null}
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
      {!isBossDamageMarker && !isDeathMarker ? (
        <div style={rowStyle}>
          <span>Threat: {formatThreatValue(data)}</span>
          <span>&sum; {formatTooltipNumber(data.totalThreat)}</span>
        </div>
      ) : null}
      {data.auraLabel && data.auraStatusColor ? (
        <div>
          Aura:{' '}
          <strong style={{ color: data.auraStatusColor }}>
            {data.auraLabel}
          </strong>
        </div>
      ) : null}
      {data.note ? (
        <div>
          Note: <strong>{data.note}</strong>
        </div>
      ) : null}
      {data.markerKind === 'bossMelee' ? (
        <div>
          Marker:{' '}
          <strong style={{ color: bossMeleeMarkerColor }}>Boss damage</strong>
        </div>
      ) : data.markerKind === 'death' ? (
        <div>
          Marker: <strong style={{ color: deathMarkerColor }}>Death</strong>
        </div>
      ) : data.markerKind === 'tranquilAirTotem' ? (
        <div>
          Marker:{' '}
          <strong style={{ color: tranquilAirTotemMarkerColor }}>
            Tranquil Air Totem
          </strong>
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
