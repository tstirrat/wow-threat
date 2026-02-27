/**
 * API Contract Types
 *
 * Frontend-facing response contracts for the public HTTP API.
 */
import type { AugmentedEvent } from '@wow-threat/shared'
import type { PlayerClass, ReportVisibility, Zone } from '@wow-threat/wcl-types'

export type ReportActorType = 'Player' | 'NPC' | 'Pet'
export type ReportActorSubType = PlayerClass | 'Boss' | 'NPC'
export type ReportActorRole = 'Tank' | 'Healer' | 'DPS'

export interface ReportActorSummary {
  id: number
  gameID?: number
  name: string
  type: ReportActorType
  subType?: ReportActorSubType
  spec?: string
  petOwner?: number | null
  role?: ReportActorRole
}

export interface ReportAbilitySummary {
  gameID: number | null
  icon: string | null
  name: string | null
  type: string | null
}

export interface ReportFightParticipant {
  id: number
  gameID: number
  name?: string
  instanceCount: number
  groupCount: number
  petOwner: number | null
}

export interface ReportFightSummary {
  id: number
  encounterID: number | null
  classicSeasonID?: number | null
  name: string
  startTime: number
  endTime: number
  kill: boolean
  difficulty: number | null
  bossPercentage: number | null
  fightPercentage: number | null
  enemyNPCs: ReportFightParticipant[]
  enemyPets: ReportFightParticipant[]
  friendlyPlayers: number[]
  friendlyPets: ReportFightParticipant[]
}

export interface ThreatConfigSummary {
  displayName: string
  version: number
}

export interface ReportGuildSummary {
  id: number | null
  name: string
  faction: string
  serverSlug: string | null
  serverRegion: string | null
}

export interface ReportArchiveStatusSummary {
  isArchived: boolean
  isAccessible: boolean
  archiveDate: number | null
}

export interface ReportResponse {
  code: string
  title: string
  visibility: ReportVisibility
  owner: string
  guild: ReportGuildSummary | null
  archiveStatus: ReportArchiveStatusSummary | null
  startTime: number
  endTime: number
  gameVersion: number
  threatConfig: ThreatConfigSummary | null
  zone: Zone
  fights: ReportFightSummary[]
  actors: ReportActorSummary[]
  abilities: ReportAbilitySummary[]
}

export type RecentReportSource = 'personal' | 'guild'

export interface RecentReportSummary {
  code: string
  title: string
  startTime: number
  endTime: number
  zoneName: string | null
  guildName: string | null
  guildFaction: string | null
  source: RecentReportSource
}

export interface RecentReportsResponse {
  reports: RecentReportSummary[]
}

export type ReportEntityType = 'guild' | 'character'

export interface EntityReportSummary {
  code: string
  title: string
  startTime: number
  endTime: number
  zoneName: string | null
  guildName: string | null
  guildFaction: string | null
}

export interface EntitySummary {
  id: number
  name: string
  faction: string | null
  serverSlug: string | null
  serverRegion: string | null
}

export interface EntityReportsResponse {
  entityType: ReportEntityType
  entity: EntitySummary
  reports: EntityReportSummary[]
}

export interface WclRateLimitResponse {
  limitPerHour: number
  pointsSpentThisHour: number
  pointsResetIn: number
}

export interface FightsResponse {
  id: number
  reportCode: string
  name: string
  startTime: number
  endTime: number
  kill: boolean
  difficulty: number | null
  enemies: ReportActorSummary[]
  actors: ReportActorSummary[]
}

export interface AugmentedEventsResponse {
  reportCode: string
  fightId: number
  fightName: string
  gameVersion: number
  configVersion: string
  events: AugmentedEvent[]
  initialAurasByActor?: Record<string, number[]>
}
