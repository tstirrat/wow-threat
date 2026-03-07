/**
 * Message contracts for threat engine worker processing.
 */
import type { Report, WCLEvent } from '@wow-threat/wcl-types'

import type { ThreatWorkerProcessedEventsPayload } from '../lib/threat-engine-worker-cache'

interface ThreatEngineWorkerBasePayload {
  fightId: number
  inferThreatReduction: boolean
  initialAurasByActor?: Record<string, number[]>
  report: Report
  tankActorIds: number[]
}

export interface ThreatEngineWorkerDirectPayload extends ThreatEngineWorkerBasePayload {
  inputMode: 'direct'
  rawEvents: WCLEvent[]
}

export interface ThreatEngineWorkerIndexedDbPayload extends ThreatEngineWorkerBasePayload {
  inputMode: 'indexeddb'
  jobKey: string
  rawEventChunkCount: number
  rawEventCount: number
}

export type ThreatEngineWorkerPayload =
  | ThreatEngineWorkerDirectPayload
  | ThreatEngineWorkerIndexedDbPayload

export interface ThreatEngineWorkerRequest {
  payload: ThreatEngineWorkerPayload
  requestId: string
}

export type ThreatEngineWorkerProcessedPayload =
  ThreatWorkerProcessedEventsPayload

interface ThreatEngineWorkerSuccessResponseBase {
  debug?: {
    augmentedEventCount: number
    processDurationMs: number
    rawEventCount: number
  }
  requestId: string
  status: 'success'
}

export interface ThreatEngineWorkerInlineSuccessResponse extends ThreatEngineWorkerSuccessResponseBase {
  outputMode: 'inline'
  payload: ThreatEngineWorkerProcessedPayload
}

export interface ThreatEngineWorkerIndexedDbSuccessResponse extends ThreatEngineWorkerSuccessResponseBase {
  jobKey: string
  outputMode: 'indexeddb'
  rawEventChunkCount: number
  rawEventCount: number
}

export type ThreatEngineWorkerSuccessResponse =
  | ThreatEngineWorkerInlineSuccessResponse
  | ThreatEngineWorkerIndexedDbSuccessResponse

export interface ThreatEngineWorkerErrorResponse {
  debug?: {
    processDurationMs: number
    rawEventCount: number
  }
  error: string
  errorName?: string
  errorStack?: string
  requestId: string
  status: 'error'
}

export type ThreatEngineWorkerResponse =
  | ThreatEngineWorkerSuccessResponse
  | ThreatEngineWorkerErrorResponse
