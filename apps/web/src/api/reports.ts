/**
 * API functions for report, fight, and event data.
 */
import { defaultApiBaseUrl } from '../lib/constants'
import type {
  AugmentedEventsResponse,
  FightsResponse,
  RecentReportsResponse,
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
  configVersion: string | null,
  inferThreatReduction: boolean,
): Promise<AugmentedEventsResponse> {
  const searchParams = new URLSearchParams()
  if (configVersion) {
    searchParams.set('configVersion', configVersion)
  }
  searchParams.set('inferThreatReduction', String(inferThreatReduction))
  const query = searchParams.toString()

  return requestJson<AugmentedEventsResponse>(
    `${defaultApiBaseUrl}/v1/reports/${reportId}/fights/${fightId}/events${query ? `?${query}` : ''}`,
  )
}

/** Fetch merged personal and guild recent reports for the signed-in user. */
export function getRecentReports(limit = 10): Promise<RecentReportsResponse> {
  const searchParams = new URLSearchParams({
    limit: String(limit),
  })

  return requestJson<RecentReportsResponse>(
    `${defaultApiBaseUrl}/v1/reports/recent?${searchParams.toString()}`,
  )
}

export const reportQueryKey = (
  reportId: string,
): readonly ['report', string] => ['report', reportId]

export const recentReportsQueryKey = (
  limit: number,
  uid: string | null,
): readonly ['recent-reports', number, string | null] => [
  'recent-reports',
  limit,
  uid,
]

export const fightQueryKey = (
  reportId: string,
  fightId: number,
): readonly ['fight', string, number] => ['fight', reportId, fightId]

export const fightEventsQueryKey = (
  reportId: string,
  fightId: number,
  configVersion: string | null,
  inferThreatReduction: boolean,
): readonly ['fight-events', string, number, string | null, boolean] => [
  'fight-events',
  reportId,
  fightId,
  configVersion,
  inferThreatReduction,
]
