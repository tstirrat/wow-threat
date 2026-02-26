import type { WCLEvent } from './events'

/**
 * WCL query-shape report payload types used by this app.
 *
 * These types model the GraphQL response fields our API actually selects today
 * (for example `WCLClient.getReport` and `WCLClient.getEvents`), not the full
 * Warcraft Logs schema surface.
 *
 * Keep this file aligned with selection sets in
 * `apps/api/src/services/wcl.ts`.
 *
 * For an introspection-derived schema snapshot of everything reachable from
 * `Report`, see `report-schema.ts`.
 */
export interface Zone {
  id: number
  name: string
  expansion?: {
    id: number
    name: string
  }
  partitions?: Array<{
    id: number
    name: string
  }>
}

export interface ReportFightNPC {
  id: number
  gameID: number
  instanceCount: number // Multiple of same enemy
  groupCount: number
  petOwner?: number | null
}

/**
 * WCL `Report.visibility` is a GraphQL `String!`; the app normalizes values to
 * public/private but unknown future values should remain type-safe.
 */
export type ReportVisibility = 'public' | 'private' | (string & {})

export interface PhaseMetadata {
  id: number
  name: string
  isIntermission?: boolean | null
}

export interface ReportEncounterPhases {
  encounterID: number
  separatesWipes?: boolean | null
  phases: PhaseMetadata[]
}

export interface ReportFight {
  id: number
  encounterID?: number | null
  classicSeasonID?: number | null
  name: string
  startTime: number
  endTime: number
  kill: boolean
  difficulty: number | null
  bossPercentage: number | null
  fightPercentage: number | null
  enemyNPCs: ReportFightNPC[]
  enemyPets: ReportFightNPC[]
  enemyPlayers?: number[]
  friendlyPlayers: number[]
  friendlyPets: ReportFightNPC[]
  friendlyNPCs?: ReportFightNPC[]

  // ReportFight fields available in schema but not currently selected by API
  averageItemLevel?: number | null
  completeRaid?: boolean
  hardModeLevel?: number | null
  inProgress?: boolean | null
  keystoneAffixes?: number[]
  keystoneBonus?: number | null
  keystoneLevel?: number | null
  keystoneTime?: number | null
  lastPhase?: number | null
  lastPhaseAsAbsoluteIndex?: number | null
  lastPhaseIsIntermission?: boolean | null
  layer?: number | null
  originalEncounterID?: number | null
  rating?: number | null
  size?: number | null
  wipeCalledTime?: number | null
}

export type PlayerClass =
  | 'Warrior'
  | 'Paladin'
  | 'Hunter'
  | 'Rogue'
  | 'Priest'
  | 'Death Knight'
  | 'Shaman'
  | 'Mage'
  | 'Warlock'
  | 'Monk'
  | 'Druid'
  | 'Demon Hunter'
  | 'Evoker'

export type ReportActor = {
  /** report id */
  id: number
  /** Game id. Optional because some queries do not request it. */
  gameID?: number
  /** Optional because some queries do not request it. */
  icon?: string
  name: string
  /** Optional because some queries do not request it. */
  server?: string
} & (ReportActorPlayer | ReportActorNPC | ReportActorPet)

export interface ReportActorNPC {
  type: 'NPC'
  subType: 'Boss' | 'NPC'
}

export interface ReportActorPlayer {
  type: 'Player'
  subType: PlayerClass
}

export interface ReportActorPet {
  type: 'Pet'
  petOwner: number | null
}

export interface GameFaction {
  id: number
  name: string
}

export interface ReportGuild {
  id?: number
  name: string
  faction: GameFaction
  server?: {
    slug?: string | null
    region?: {
      id?: number
      compactName?: string
      name?: string
      slug?: string
    } | null
  } | null
}

export interface ReportOwner {
  name: string
}

export interface ReportArchiveStatus {
  isArchived: boolean
  isAccessible: boolean
  archiveDate: number | null
}

export interface ReportAbility {
  gameID: number | null
  icon: string | null
  name: string | null
  type: string | null
}

export interface ReportMasterData {
  gameVersion: number
  actors: ReportActor[]
  abilities?: ReportAbility[]
  logVersion?: number
  lang?: string | null
}

export interface ReportRankedCharacterServer {
  id: number
  name: string
  normalizedName?: string
  slug?: string
}

export type ReportRankingCompareType = 'Rankings' | 'Parses'
export type ReportRankingTimeframeType = 'Today' | 'Historical'
export type ReportRoleType = 'Any' | 'DPS' | 'Healer' | 'Tank'

export interface ReportRankingsCharacter {
  id: number
  name: string
  server: {
    id: number | null
    name: string | null
    region: 'US' | 'EU' | 'TW' | 'KR' | 'CN'
  } | null
  class: PlayerClass
  spec: string
  amount: number
  rank: number
  best: number
  totalParses: number
  rankPercent: number
  bracketData: number
  bracket: number
}

export interface ReportRankingsRoleGroup {
  name: 'Tanks' | 'Healers' | 'Damage Dealers'
  characters: ReportRankingsCharacter[]
}

export interface ReportRankingsRoles {
  tanks?: ReportRankingsRoleGroup | null
  healers?: ReportRankingsRoleGroup | null
  dps?: ReportRankingsRoleGroup | null
}

export interface ReportEncounterRankingsEntry {
  fightID: number
  partition: number
  zone: number
  difficulty: number
  size: number
  kill: number
  duration: number
  encounter: {
    id: number
    name: string
  }
  roles: ReportRankingsRoles
}

export interface ReportEncounterRankings {
  data: ReportEncounterRankingsEntry[]
}

export interface ReportRankedCharacter {
  canonicalID: number
  claimed?: boolean | null
  classID: number
  faction: GameFaction
  guildRank: number
  hidden: boolean
  id: number
  level: number
  name: string
  server: ReportRankedCharacterServer
  encounterRankings?: unknown
  zoneRankings?: unknown
}

export interface ReportPlayerDetailsSpec {
  spec: string
  count: number
}

export interface ReportPlayerDetailEntry {
  id: number
  name: string
  type: string
  icon?: string | null
  specs: ReportPlayerDetailsSpec[]
}

export interface ReportPlayerDetailsByRole {
  tanks?: ReportPlayerDetailEntry[]
  healers?: ReportPlayerDetailEntry[]
  dps?: ReportPlayerDetailEntry[]
}

export interface ReportPlayerDetails {
  data?: {
    playerDetails?: ReportPlayerDetailsByRole | null
  } | null
}

export interface Report {
  code: string
  title: string
  owner: ReportOwner
  visibility?: ReportVisibility | null
  guild: ReportGuild | null
  startTime: number // Unix timestamp ms
  endTime: number
  zone: Zone
  fights: ReportFight[]
  masterData: ReportMasterData
  archiveStatus?: ReportArchiveStatus | null

  // Report-root fields available by selection when needed
  rankedCharacters?: ReportRankedCharacter[] | null
  rankings: ReportEncounterRankings | unknown | null
  playerDetails?: ReportPlayerDetails | null
  phases?: ReportEncounterPhases[] | null
}

/** WCL GraphQL response wrapper for report data */
export interface WCLReportResponse {
  data: {
    reportData: {
      report: Report
    }
  }
}

/** WCL GraphQL response wrapper for events */
export interface WCLEventsResponse {
  data: {
    reportData: {
      report: {
        events: {
          data: WCLEvent[]
          nextPageTimestamp: number | null
        }
      }
    }
  }
}
