/**
 * API functions for report, fight, and event data.
 */
import { configCacheVersion } from '@wow-threat/config'
import { immutableApiCacheVersions } from '@wow-threat/shared'

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
  const searchParams = new URLSearchParams({
    cv: immutableApiCacheVersions.report,
  })

  return requestJson<ReportResponse>(
    `${defaultApiBaseUrl}/v1/reports/${reportId}?${searchParams.toString()}`,
  )
}

/** Fetch fight metadata for a report and fight ID. */
export function getFight(
  reportId: string,
  fightId: number,
): Promise<FightsResponse> {
  const searchParams = new URLSearchParams({
    cv: immutableApiCacheVersions.fight,
  })

  return requestJson<FightsResponse>(
    `${defaultApiBaseUrl}/v1/reports/${reportId}/fights/${fightId}?${searchParams.toString()}`,
  )
}

/** Fetch augmented events for a report + fight. */
export function getFightEvents(
  reportId: string,
  fightId: number,
  inferThreatReduction: boolean,
): Promise<AugmentedEventsResponse> {
  const searchParams = new URLSearchParams({
    cv: configCacheVersion,
  })
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
  inferThreatReduction: boolean,
): readonly ['fight-events', string, number, string, boolean] => [
  'fight-events',
  reportId,
  fightId,
  configCacheVersion,
  inferThreatReduction,
]
