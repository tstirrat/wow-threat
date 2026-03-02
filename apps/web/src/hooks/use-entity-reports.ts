/**
 * Query hook for entity-scoped report listings.
 */
import { entityReportsQueryKey, getEntityReports } from '@/api/reports'
import { useAuth } from '@/auth/auth-provider'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { starredGuildReportsCacheTtlMs } from '../lib/constants'
import {
  buildEntityReportsCacheKey,
  loadEntityReportsCache,
  saveEntityReportsCache,
} from '../lib/entity-reports-cache'
import type { EntityReportsResponse } from '../types/api'

export interface UseEntityReportsOptions {
  entityType: 'guild'
  guildId?: number
  guildName?: string
  serverSlug?: string
  serverRegion?: string
  limit?: number
}

export interface UseEntityReportsResult {
  response: EntityReportsResponse | null
  isLoading: boolean
  isRefreshing: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/** Fetch reports for a single entity with a one-hour local cache. */
export function useEntityReports(
  options: UseEntityReportsOptions,
): UseEntityReportsResult {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const cacheUid = uid ?? 'public'
  const limit = options.limit ?? 10
  const entityCacheKey = buildEntityReportsCacheKey({
    ...options,
    limit,
  })
  const cached = loadEntityReportsCache(cacheUid, entityCacheKey)

  const query = useQuery({
    queryKey: entityReportsQueryKey(
      {
        ...options,
        limit,
      },
      uid,
    ),
    queryFn: async () =>
      getEntityReports({
        ...options,
        limit,
      }),
    enabled: true,
    staleTime: starredGuildReportsCacheTtlMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialData: cached?.response,
    initialDataUpdatedAt: cached?.fetchedAtMs,
  })

  useEffect(() => {
    if (!query.data || query.dataUpdatedAt <= 0) {
      return
    }

    saveEntityReportsCache(
      cacheUid,
      entityCacheKey,
      query.data,
      query.dataUpdatedAt,
    )
  }, [cacheUid, entityCacheKey, query.data, query.dataUpdatedAt])

  return {
    response: query.data ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    error: query.error,
    refresh: async () => {
      await query.refetch()
    },
  }
}
