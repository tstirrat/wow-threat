/**
 * Roster threat rows: cumulative threat and rolling TPS at a point in time.
 */
import type { ThreatSeries } from '../types/app'
import { findLastPointAtOrBefore } from './threat-at-time'

/** Rolling window used for the roster TPS column. */
export const ROSTER_TPS_WINDOW_MS = 5_000

export interface RosterThreatRow {
  series: ThreatSeries
  threat: number
  tps: number
}

/** Latest point time across all series, i.e. the end of the fight's threat data. */
export function resolveSeriesEndMs(series: ThreatSeries[]): number {
  return series.reduce(
    (end, item) => Math.max(end, item.points.at(-1)?.timeMs ?? 0),
    0,
  )
}

/** Build roster rows sorted by threat at `timeMs` (the end of the data when null). */
export function buildRosterThreatRows(
  series: ThreatSeries[],
  timeMs: number | null,
  tpsWindowMs: number = ROSTER_TPS_WINDOW_MS,
): RosterThreatRow[] {
  const atMs = timeMs ?? resolveSeriesEndMs(series)
  const fromMs = Math.max(0, atMs - tpsWindowMs)

  return series
    .map((item) => {
      const threat =
        findLastPointAtOrBefore(item.points, atMs)?.totalThreat ?? 0
      const before =
        findLastPointAtOrBefore(item.points, fromMs)?.totalThreat ?? 0
      const seconds = (atMs - fromMs) / 1000

      return {
        series: item,
        threat,
        tps: seconds > 0 ? (threat - before) / seconds : 0,
      }
    })
    .sort((a, b) => b.threat - a.threat)
}

export type RosterShowPreset = 'all' | 'tanks' | 'top' | 'custom'

export const ROSTER_TOP_COUNT = 5

/** Actor ids each show preset would make visible. */
export function resolveRosterPresetIds(
  rows: RosterThreatRow[],
): Record<Exclude<RosterShowPreset, 'custom'>, number[]> {
  return {
    all: rows.map((row) => row.series.actorId),
    tanks: rows
      .filter(
        (row) =>
          row.series.actorType === 'Player' && row.series.actorRole === 'Tank',
      )
      .map((row) => row.series.actorId),
    top: rows.slice(0, ROSTER_TOP_COUNT).map((row) => row.series.actorId),
  }
}

/** Which preset (if any) matches the currently visible actors. */
export function resolveRosterShowPreset(
  rows: RosterThreatRow[],
  isActorVisible: (actorId: number) => boolean,
): RosterShowPreset {
  const visible = new Set(
    rows.map((row) => row.series.actorId).filter(isActorVisible),
  )
  const presets = resolveRosterPresetIds(rows)
  const matches = (ids: number[]): boolean =>
    ids.length === visible.size && ids.every((id) => visible.has(id))

  return matches(presets.all)
    ? 'all'
    : matches(presets.tanks)
      ? 'tanks'
      : matches(presets.top)
        ? 'top'
        : 'custom'
}
