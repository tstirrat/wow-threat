/**
 * WCL Report and Fight Types
 */

export interface Zone {
  id: number
  name: string
}

export interface FightSummary {
  id: number
  name: string // e.g., "Ragnaros"
  startTime: number // Relative to report start
  endTime: number
  kill: boolean
  difficulty: number | null
  bossPercentage: number | null
  fightPercentage: number | null
}

export interface Phase {
  id: number
  name: string
  startTime: number
  endTime: number
}

export interface Report {
  code: string
  title: string
  owner: string
  startTime: number // Unix timestamp ms
  endTime: number
  gameVersion: number // WCL gameVersion integer (determines threat config)
  zone: Zone
  fights: FightSummary[]
  actors: {
    players: import('./actors').Actor[]
    enemies: import('./actors').Actor[]
    pets: import('./actors').Actor[]
  }
}

export interface Fight {
  id: number
  reportCode: string
  name: string
  startTime: number
  endTime: number
  kill: boolean
  difficulty: number | null
  enemies: import('./actors').Enemy[]
  actors: import('./actors').FightActor[]
  phases: Phase[]
}

/** WCL GraphQL response wrapper for report data */
export interface WCLReportResponse {
  data: {
    reportData: {
      report: {
        code: string
        title: string
        owner: { name: string }
        startTime: number
        endTime: number
        zone: Zone
        fights: FightSummary[]
        masterData: {
          gameVersion: number
          actors: Array<{
            id: number
            name: string
            type: string
            subType: string
            petOwner: number | null
          }>
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
          data: unknown[]
          nextPageTimestamp: number | null
        }
      }
    }
  }
}
