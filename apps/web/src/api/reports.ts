/**
 * API functions for report, fight, and event data.
 */
import { configCacheVersion } from '@wow-threat/config'
import { immutableApiCacheVersions } from '@wow-threat/shared'

import { defaultApiBaseUrl } from '../lib/constants'
import type {
  EntityReportsResponse,
  FightEventsResponse,
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

/** Fetch one events page for a report + fight. */
export function getFightEventsPage(
  reportId: string,
  fightId: number,
  cursor?: number,
  signal?: AbortSignal,
): Promise<FightEventsResponse> {
  const searchParams = new URLSearchParams({
    cv: configCacheVersion,
  })
  if (typeof cursor === 'number' && Number.isFinite(cursor)) {
    searchParams.set('cursor', String(Math.trunc(cursor)))
  }

  return requestJson<FightEventsResponse>(
    `${defaultApiBaseUrl}/v1/reports/${reportId}/fights/${fightId}/events?${searchParams.toString()}`,
    {
      signal,
    },
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

/** Fetch recent reports for an entity (guild currently supported). */
export function getEntityReports(options: {
  entityType: 'guild'
  guildId?: number
  guildName?: string
  serverSlug?: string
  serverRegion?: string
  limit?: number
}): Promise<EntityReportsResponse> {
  const searchParams = new URLSearchParams({
    limit: String(options.limit ?? 10),
  })
  if (typeof options.guildId === 'number' && Number.isFinite(options.guildId)) {
    searchParams.set('guildId', String(Math.trunc(options.guildId)))
  }
  if (options.guildName) {
    searchParams.set('guildName', options.guildName)
  }
  if (options.serverSlug) {
    searchParams.set('serverSlug', options.serverSlug)
  }
  if (options.serverRegion) {
    searchParams.set('serverRegion', options.serverRegion)
  }

  return requestJson<EntityReportsResponse>(
    `${defaultApiBaseUrl}/v1/reports/entities/${options.entityType}/reports?${searchParams.toString()}`,
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

export const entityReportsQueryKey = (
  options: {
    entityType: 'guild'
    guildId?: number
    guildName?: string
    serverSlug?: string
    serverRegion?: string
    limit: number
  },
  uid: string | null,
): readonly [
  'entity-reports',
  'guild',
  number | null,
  string | null,
  string | null,
  string | null,
  number,
  string | null,
] => [
  'entity-reports',
  'guild',
  options.guildId ?? null,
  options.guildName ?? null,
  options.serverSlug ?? null,
  options.serverRegion ?? null,
  options.limit,
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
