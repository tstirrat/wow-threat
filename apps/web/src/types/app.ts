/**
 * Shared frontend app-level types.
 */
import type { HitType, PlayerClass } from '@wow-threat/wcl-types'

export type WarcraftLogsHost =
  | 'fresh.warcraftlogs.com'
  | 'sod.warcraftlogs.com'
  | 'vanilla.warcraftlogs.com'

export interface RecentReportEntry {
  reportId: string
  title: string
  sourceHost: WarcraftLogsHost
  lastOpenedAt: number
  zoneName?: string | null
  startTime?: number | null
  bossKillCount?: number | null
  guildName?: string | null
  guildFaction?: string | null
  isArchived?: boolean | null
  isAccessible?: boolean | null
  archiveDate?: number | null
}

export interface ExampleReportLink {
  label: string
  reportId: string
  host: WarcraftLogsHost
  href: string
}

export interface WowheadLinksConfig {
  domain: string
}

export interface FightQueryState {
  players: number[]
  focusId: number | null
  targetId: number | null
  targetInstance: number | null
  startMs: number | null
  endMs: number | null
}

export interface FightTarget {
  id: number
  instance: number
}

export interface FightTargetOption extends FightTarget {
  key: string
  name: string
  label: string
  isBoss: boolean
}

export interface ThreatPoint {
  timestamp: number
  timeMs: number
  totalThreat: number
  threatDelta: number
  amount: number
  baseThreat: number
  modifiedThreat: number
  spellId?: number
  spellSchool: string | null
  resourceType?: number | null
  eventType: string
  abilityName: string
  targetName?: string | null
  hitType?: HitType | number
  isTick?: boolean
  formula: string
  modifiers: ThreatPointModifier[]
  markerKind?: ThreatPointMarkerKind
}

export interface ThreatPointModifier {
  name: string
  schoolLabels: string[]
  value: number
}

export type ThreatPointMarkerKind = 'bossMelee' | 'death'

export type ThreatStateVisualKind = 'fixate' | 'aggroLoss' | 'invulnerable'

export interface ThreatStateWindow {
  startMs: number
  endMs: number
}

export interface ThreatStateVisualSegment extends ThreatStateWindow {
  kind: ThreatStateVisualKind
  spellId?: number
  spellName?: string
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
  talentPoints: [number, number, number] | undefined
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
  tps: number | null
  isHeal: boolean
  isFixate: boolean
}

export interface InitialAuraDisplay {
  spellId: number
  name: string
  stacks: number
  isNotable: boolean
}
