/**
 * Message contracts for threat engine worker processing.
 */
import type { AugmentedEvent } from '@wow-threat/shared'
import type { Report, WCLEvent } from '@wow-threat/wcl-types'

export interface ThreatEngineWorkerPayload {
  fightId: number
  inferThreatReduction: boolean
  initialAurasByActor?: Record<string, number[]>
  rawEvents: WCLEvent[]
  report: Report
  tankActorIds: number[]
}

export interface ThreatEngineWorkerRequest {
  payload: ThreatEngineWorkerPayload
  requestId: string
}

export interface ThreatEngineWorkerSuccessResponse {
  payload: {
    augmentedEvents: AugmentedEvent[]
    initialAurasByActor: Record<string, number[]>
    processDurationMs: number
  }
  requestId: string
  status: 'success'
}

export interface ThreatEngineWorkerErrorResponse {
  error: string
  requestId: string
  status: 'error'
}

export type ThreatEngineWorkerResponse =
  | ThreatEngineWorkerSuccessResponse
  | ThreatEngineWorkerErrorResponse
