/**
 * API Contract Types
 *
 * Frontend-facing response contracts for the public HTTP API.
 */
import type { AugmentedEvent } from '@wcl-threat/shared'
import type { PlayerClass, ReportVisibility, Zone } from '@wcl-threat/wcl-types'

export type ReportActorType = 'Player' | 'NPC' | 'Pet'
export type ReportActorSubType = PlayerClass | 'Boss' | 'NPC'

export interface ReportActorSummary {
  id: number
  gameID?: number
  name: string
  type: ReportActorType
  subType?: ReportActorSubType
  petOwner?: number | null
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
  version: string
}

export interface ReportGuildSummary {
  name: string
  faction: string
}

export interface ReportResponse {
  code: string
  title: string
  visibility: ReportVisibility
  owner: string
  guild: ReportGuildSummary | null
  startTime: number
  endTime: number
  gameVersion: number
  threatConfig: ThreatConfigSummary | null
  zone: Zone
  fights: ReportFightSummary[]
  actors: ReportActorSummary[]
  abilities: ReportAbilitySummary[]
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
  summary: {
    totalEvents: number
    eventCounts: Record<string, number>
    duration: number
  }
}
