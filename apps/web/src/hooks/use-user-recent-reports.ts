/**
 * Query hook for merged personal and guild recent reports.
 */
import { useAuth } from '@/auth/auth-provider'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { getRecentReports, recentReportsQueryKey } from '../api/reports'
import {
  loadAccountRecentReportsCache,
  saveAccountRecentReportsCache,
} from '../lib/account-recent-reports-cache'
import { accountRecentReportsCacheTtlMs } from '../lib/constants'
import type { RecentReportSummary } from '../types/api'

const defaultRecentReportsLimit = 10

export interface UseUserRecentReportsOptions {
  enabled?: boolean
  staleTimeMs?: number
}

export interface UseUserRecentReportsResult {
  reports: RecentReportSummary[]
  isLoading: boolean
  isRefreshing: boolean
  hasFetched: boolean
  hasFetchedSuccessfully: boolean
  dataUpdatedAt: number
  error: Error | null
  refresh: () => Promise<void>
}

/** Fetch recent reports for the signed-in Warcraft Logs account. */
export function useUserRecentReports(
  limit = defaultRecentReportsLimit,
  options: UseUserRecentReportsOptions = {},
): UseUserRecentReportsResult {
  const { authEnabled, user, wclUserId } = useAuth()
  const uid = user?.uid ?? null
  const cached = uid ? loadAccountRecentReportsCache(uid) : null
  const isEnabled = options.enabled ?? true

  const query = useQuery({
    queryKey: recentReportsQueryKey(limit, uid),
    queryFn: async () => {
      const response = await getRecentReports(limit)
      return response.reports
    },
    enabled: isEnabled && authEnabled && Boolean(uid) && Boolean(wclUserId),
    staleTime: options.staleTimeMs ?? accountRecentReportsCacheTtlMs,
    initialData: cached?.reports,
    initialDataUpdatedAt: cached?.fetchedAtMs,
  })

  useEffect(() => {
    if (!uid || !query.data || query.dataUpdatedAt <= 0) {
      return
    }

    saveAccountRecentReportsCache(uid, query.data, query.dataUpdatedAt)
  }, [uid, query.data, query.dataUpdatedAt])

  return {
    reports: query.data ?? [],
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
