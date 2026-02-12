/**
 * Shared frontend app-level types.
 */
import type { PlayerClass } from '@wcl-threat/wcl-types'

export type WarcraftLogsHost =
  | 'fresh.warcraftlogs.com'
  | 'sod.warcraftlogs.com'
  | 'vanilla.warcraftlogs.com'

export interface RecentReportEntry {
  reportId: string
  title: string
  sourceHost: WarcraftLogsHost
  lastOpenedAt: number
}

export interface ExampleReportLink {
  label: string
  reportId: string
  host: WarcraftLogsHost
  href: string
}

export interface FightQueryState {
  players: number[]
  targetId: number | null
  startMs: number | null
  endMs: number | null
}

export interface ThreatPoint {
  timestamp: number
  timeMs: number
  totalThreat: number
  threatDelta: number
  amount: number
  baseThreat: number
  modifiedThreat: number
  eventType: string
  abilityName: string
  formula: string
  modifiers: string
}

export type ThreatStateVisualKind = 'fixate' | 'aggroLoss' | 'invulnerable'

export interface ThreatStateWindow {
  startMs: number
  endMs: number
}

export interface ThreatStateVisualSegment extends ThreatStateWindow {
  kind: ThreatStateVisualKind
}

export interface ThreatSeries {
  actorId: number
  actorName: string
  actorClass: PlayerClass | null
  actorType: 'Player' | 'Pet'
  ownerId: number | null
  label: string
  color: string
  points: ThreatPoint[]
  maxThreat: number
  totalThreat: number
  totalDamage: number
  totalHealing: number
  stateVisualSegments: ThreatStateVisualSegment[]
  fixateWindows: ThreatStateWindow[]
  invulnerabilityWindows: ThreatStateWindow[]
}

export interface PlayerSummaryRow {
  actorId: number
  label: string
  actorClass: PlayerClass | null
  totalThreat: number
  totalDamage: number
  totalHealing: number
  color: string
}

export interface FocusedPlayerSummary {
  actorId: number
  label: string
  actorClass: PlayerClass | null
  totalThreat: number
  totalTps: number
  totalDamage: number
  totalHealing: number
  color: string
}

export interface FocusedPlayerThreatRow {
  key: string
  abilityId: number | null
  abilityName: string
  amount: number
  threat: number
  tps: number
}
