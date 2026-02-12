/**
 * Helpers for deriving ECharts visualMap and markArea config from threat state windows.
 */
import type { EChartsOption } from 'echarts'

import type { ThreatSeries, ThreatStateWindow } from '../types/app'

export const stateColorByKind = {
  fixate: '#ffa500',
  invulnerable: '#0f0',
  aggroLoss: '#ff0',
} as const

const stateLabelByKind = {
  fixate: 'fixate',
  invulnerable: 'invulnerability',
  aggroLoss: 'aggro loss',
} as const

export const fixateMarkAreaColor = 'rgba(255, 173, 177, 0.4)'
export const invulnerabilityMarkAreaColor = 'rgba(15, 255, 15, 0.14)'

function buildFixateMarkAreaData(
  windows: ThreatStateWindow[],
): Array<[Record<string, number>, Record<string, number>]> {
  return windows
    .filter((window) => window.endMs > window.startMs)
    .map((window) => [{ xAxis: window.startMs }, { xAxis: window.endMs }])
}

/** Build hidden piecewise visualMap entries that recolor line segments by state windows. */
export function buildThreatStateVisualMaps(
  series: ThreatSeries[],
): NonNullable<EChartsOption['visualMap']> {
  const stateVisualMaps = series
    .map((item, seriesIndex) => {
      const pieces = item.stateVisualSegments
        .filter((segment) => segment.endMs > segment.startMs)
        .map((segment) => ({
          gte: segment.startMs,
          lt: segment.endMs,
          color: stateColorByKind[segment.kind],
        }))

      if (pieces.length === 0) {
        return null
      }

      return {
        type: 'piecewise' as const,
        show: false,
        seriesIndex,
        dimension: 0,
        pieces,
        outOfRange: {
          color: item.color,
        },
      }
    })
    .filter((entry) => entry !== null)

  return stateVisualMaps
}

/** Build per-series markArea for fixate windows. */
export function buildFixateMarkArea(
  windows: ThreatStateWindow[],
): Exclude<EChartsOption['series'], undefined>[number]['markArea'] | undefined {
  const data = buildFixateMarkAreaData(windows)
  if (data.length === 0) {
    return undefined
  }

  return {
    silent: true,
    itemStyle: {
      color: fixateMarkAreaColor,
    },
    data,
  }
}

/** Build markArea for fixate and invulnerability windows with per-aura shading colors. */
export function buildAuraMarkArea(
  item: Pick<ThreatSeries, 'fixateWindows' | 'invulnerabilityWindows'>,
): Exclude<EChartsOption['series'], undefined>[number]['markArea'] | undefined {
  const fixateData = buildFixateMarkAreaData(item.fixateWindows).map((window) => [
    {
      ...window[0],
      itemStyle: {
        color: fixateMarkAreaColor,
      },
    },
    window[1],
  ])
  const invulnerabilityData = buildFixateMarkAreaData(
    item.invulnerabilityWindows,
  ).map((window) => [
    {
      ...window[0],
      itemStyle: {
        color: invulnerabilityMarkAreaColor,
      },
    },
    window[1],
  ])
  const data = [...fixateData, ...invulnerabilityData]
  if (data.length === 0) {
    return undefined
  }

  return {
    silent: true,
    data,
  }
}

/** Resolve point-in-time status label and color from state visual segments. */
export function resolveThreatStateStatus(
  item: Pick<ThreatSeries, 'stateVisualSegments'>,
  timeMs: number,
): { color: string | null; label: string } {
  const activeSegment = item.stateVisualSegments.find(
    (segment) => segment.startMs <= timeMs && timeMs < segment.endMs,
  )
  if (!activeSegment) {
    return {
      color: null,
      label: 'Normal',
    }
  }

  return {
    color: stateColorByKind[activeSegment.kind],
    label: stateLabelByKind[activeSegment.kind],
  }
}
