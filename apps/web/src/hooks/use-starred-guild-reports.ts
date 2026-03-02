/**
 * Query hook for merged report feed across starred guilds.
 */
import { getEntityReports } from '@/api/reports'
import { useAuth } from '@/auth/auth-provider'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { starredGuildReportsCacheTtlMs } from '../lib/constants'
import {
  buildStarredGuildSignature,
  loadStarredGuildReportsCache,
  saveStarredGuildReportsCache,
} from '../lib/starred-guild-reports-cache'
import type { StarredGuildReportEntry } from '../types/app'
import { useUserSettings } from './use-user-settings'

const defaultGuildReportsLimit = 10

export interface UseStarredGuildReportsOptions {
  enabled?: boolean
  staleTimeMs?: number
}

export interface UseStarredGuildReportsResult {
  reports: StarredGuildReportEntry[]
  trackedGuildCount: number
  isLoading: boolean
  isRefreshing: boolean
  hasFetched: boolean
  hasFetchedSuccessfully: boolean
  dataUpdatedAt: number
  error: Error | null
  refresh: () => Promise<void>
}

/** Fetch and cache merged guild reports for all starred guild entities. */
export function useStarredGuildReports(
  limit = defaultGuildReportsLimit,
  options: UseStarredGuildReportsOptions = {},
): UseStarredGuildReportsResult {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const cacheUid = uid ?? 'public'
  const isEnabled = options.enabled ?? true
  const { settings } = useUserSettings()
  const starredGuilds = useMemo(
    () =>
      settings.starredEntities.filter((entry) => entry.entityType === 'guild'),
    [settings.starredEntities],
  )
  const guildKeys = useMemo(
    () =>
      starredGuilds.map(
        (entry) =>
          `${entry.entityId}:${entry.serverSlug ?? ''}:${entry.serverRegion ?? ''}`,
      ),
    [starredGuilds],
  )
  const guildSignature = useMemo(
    () => buildStarredGuildSignature(guildKeys),
    [guildKeys],
  )
  const cached = loadStarredGuildReportsCache(cacheUid, guildSignature, limit)

  const query = useQuery({
    queryKey: ['starred-guild-reports', cacheUid, guildSignature, limit],
    queryFn: async (): Promise<StarredGuildReportEntry[]> => {
      const reportsByGuild = await Promise.all(
        starredGuilds.map(async (guild) => {
          const parsedGuildId = Number.parseInt(guild.entityId, 10)
          const guildId = Number.isFinite(parsedGuildId)
            ? parsedGuildId
            : undefined

          const response = await getEntityReports({
            entityType: 'guild',
            guildId,
            guildName: guild.name,
            serverSlug: guild.serverSlug ?? undefined,
            serverRegion: guild.serverRegion ?? undefined,
            limit,
          })

          return response.reports.map<StarredGuildReportEntry>((report) => ({
            reportId: report.code,
            title: report.title,
            startTime: report.startTime,
            endTime: report.endTime,
            zoneName: report.zoneName,
            guildId: String(response.entity.id),
            guildName: report.guildName ?? response.entity.name,
            guildFaction: report.guildFaction ?? response.entity.faction,
            sourceHost: guild.sourceHost,
          }))
        }),
      )

      const dedupedReports = new Map<string, StarredGuildReportEntry>()
      reportsByGuild
        .flat()
        .sort((left, right) => right.startTime - left.startTime)
        .forEach((report) => {
          if (!dedupedReports.has(report.reportId)) {
            dedupedReports.set(report.reportId, report)
          }
        })

      return Array.from(dedupedReports.values()).slice(0, limit)
    },
    enabled: isEnabled && starredGuilds.length > 0,
    staleTime: options.staleTimeMs ?? starredGuildReportsCacheTtlMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialData: cached?.reports,
    initialDataUpdatedAt: cached?.fetchedAtMs,
  })

  useEffect(() => {
    if (!query.data || query.dataUpdatedAt <= 0) {
      return
    }

    saveStarredGuildReportsCache(
      cacheUid,
      guildSignature,
      limit,
      query.data,
      query.dataUpdatedAt,
    )
  }, [cacheUid, guildSignature, limit, query.data, query.dataUpdatedAt])

  return {
    reports: query.data ?? [],
    trackedGuildCount: starredGuilds.length,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    hasFetched: query.isFetched,
    hasFetchedSuccessfully: query.isSuccess,
    dataUpdatedAt: query.dataUpdatedAt,
    error: query.error,
    refresh: async () => {
      await query.refetch()
    },
  }
}
