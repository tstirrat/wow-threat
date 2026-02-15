/**
 * API functions for report, fight, and event data.
 */
import { defaultApiBaseUrl } from '../lib/constants'
import type {
  AugmentedEventsResponse,
  FightsResponse,
  ReportResponse,
} from '../types/api'
import { requestJson } from './client'

/** Fetch report metadata for a report code. */
export function getReport(reportId: string): Promise<ReportResponse> {
  return requestJson<ReportResponse>(
    `${defaultApiBaseUrl}/v1/reports/${reportId}`,
  )
}

/** Fetch fight metadata for a report and fight ID. */
export function getFight(
  reportId: string,
  fightId: number,
): Promise<FightsResponse> {
  return requestJson<FightsResponse>(
    `${defaultApiBaseUrl}/v1/reports/${reportId}/fights/${fightId}`,
  )
}

/** Fetch augmented events for a report + fight. */
export function getFightEvents(
  reportId: string,
  fightId: number,
): Promise<AugmentedEventsResponse> {
  return requestJson<AugmentedEventsResponse>(
    `${defaultApiBaseUrl}/v1/reports/${reportId}/fights/${fightId}/events`,
  )
}

export const reportQueryKey = (
  reportId: string,
): readonly ['report', string] => ['report', reportId]

export const fightQueryKey = (
  reportId: string,
  fightId: number,
): readonly ['fight', string, number] => ['fight', reportId, fightId]

export const fightEventsQueryKey = (
  reportId: string,
  fightId: number,
): readonly ['fight-events', string, number] => [
  'fight-events',
  reportId,
  fightId,
]
