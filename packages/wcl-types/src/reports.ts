import type { WCLEvent } from './events'

/**
 * WCL Report and Fight Types
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
  /** Present when requested in GraphQL selection set */
  name?: string
  instanceCount: number // Multiple of same enemy
  groupCount: number
  petOwner?: number | null
}

export type ReportVisibility = 'public' | 'private'

export interface PhaseMetadata {
  id: number
  name: string
  startTime: number
  endTime: number
}

export interface Report {
  code: string
  title: string
  owner: string
  visibility?: ReportVisibility | null
  guild: ReportGuild | null
  startTime: number // Unix timestamp ms
  endTime: number
  gameVersion: number // WCL gameVersion integer (determines threat config)
  zone: Zone
  fights: ReportFight[]
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
  friendlyPlayers: number[]
  friendlyPets: ReportFightNPC[]
  // friendlyNPCs: ReportFightNPC[] // unused
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
  name: string
  faction: GameFaction
}

export interface ReportAbility {
  gameID: number | null
  icon: string | null
  name: string | null
  type: string | null
}

/** WCL GraphQL response wrapper for report data */
export interface WCLReportResponse {
  data: {
    reportData: {
      report: {
        code: string
        title: string
        visibility?: ReportVisibility | null
        owner: { name: string }
        guild: ReportGuild | null
        startTime: number
        endTime: number
        zone: Zone
        fights: ReportFight[]
        masterData: {
          gameVersion: number
          actors: ReportActor[]
          abilities?: ReportAbility[]
        }
      }
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
