/**
 * Threat chart tooltip formatter and tooltip-specific helpers.
 */
import { HitTypeCode, ResourceTypeCode } from '@wow-threat/wcl-types'
import { renderToString } from 'react-dom/server'

import {
  ThreatChartTooltipContent,
  type ThreatChartTooltipContentData,
} from '../components/threat-chart-tooltip-content'
import type { ThreatChartThemeColors } from '../hooks/use-threat-chart-theme-colors'
import type { ThreatSeries } from '../types/app'
import { resolveSpellSchoolColor } from './spell-school-colors'
import type { TooltipPointPayload } from './threat-chart-types'
import { resolveThreatStateStatus } from './threat-chart-visuals'

export {
  bossMeleeMarkerColor,
  deathMarkerColor,
  tranquilAirTotemMarkerColor,
} from './threat-chart-tooltip-colors'

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

  const normalized = hitTypeLabelByCode[hitType]
  if (!normalized || hitType === HitTypeCode.Hit) {
    return null
  }

  return normalized
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
    const isBossDamageMarker = markerKind === 'bossMelee'
    const isDeathMarker = markerKind === 'death'
    const abilityEventSuffix = isBossDamageMarker
      ? ' (incoming)'
      : isHealEvent
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
    const spellModifier = payload.spellModifier
    const spellModifierMultiplier = spellModifier?.value ?? 1
    const modifiersTotal = visibleModifiers.reduce((total, modifier) => {
      if (!Number.isFinite(modifier.value)) {
        return total
      }

      return total * modifier.value
    }, 1)
    const totalMultiplierWithSpell = modifiersTotal * spellModifierMultiplier
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
    const spellModifierLabel = spellModifier
      ? isHealEvent
        ? 'Heal'
        : (payload.abilityName ?? 'Unknown ability')
      : null
    const note = payload.note ?? null
    const spellId =
      typeof payload.spellId === 'number' && payload.spellId > 0
        ? payload.spellId
        : null

    const tooltipData: ThreatChartTooltipContentData = {
      abilityEventSuffix: isDeathMarker ? '' : abilityEventSuffix,
      abilityName: isDeathMarker
        ? ''
        : isBossDamageMarker
          ? `↓ ${payload.abilityName ?? 'Unknown ability'}`
          : (payload.abilityName ?? 'Unknown ability'),
      abilityTitleColor,
      actorColor: String(payload.actorColor ?? '#94a3b8'),
      actorName: String(entry.seriesName ?? 'Unknown actor'),
      amount,
      amountColor,
      amountLabel,
      amountSchool,
      auraLabel: auraStatus.color && auraStatus.label ? auraStatus.label : null,
      auraStatusColor: auraStatus.color ?? themeColors.muted,
      markerKind,
      modifiersTotal: totalMultiplierWithSpell,
      modifiedThreat,
      splitCount,
      threatDelta,
      timeMs,
      totalThreat,
      visibleModifiers,
      hitTypeLabel,
      ...(spellModifier ? { spellModifier } : {}),
      ...(spellModifierLabel ? { spellModifierLabel } : {}),
      ...(note ? { note } : {}),
      mutedColor: themeColors.muted,
      spellId,
    }

    const html = renderToString(
      <ThreatChartTooltipContent data={tooltipData} />,
    )

    return html.replaceAll('<!-- -->', '')
  }
}
