/**
 * Query hook for Warcraft Logs API rate-limit metadata.
 */
import { useAuth } from '@/auth/auth-provider'
import { useQuery } from '@tanstack/react-query'

import { getWclRateLimitData, wclRateLimitQueryKey } from '../api/wcl'
import type { WclRateLimitResponse } from '../types/api'

const rateLimitRefetchIntervalMs = 30 * 1000

export interface UseWclRateLimitResult {
  rateLimit: WclRateLimitResponse | null
  isLoading: boolean
  isRefreshing: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/** Fetch WCL rate-limit usage for the current signed-in account context. */
export function useWclRateLimit(): UseWclRateLimitResult {
  const { authEnabled, user } = useAuth()
  const uid = user?.uid ?? null
  const canQuery = authEnabled && Boolean(uid)

  const query = useQuery({
    queryKey: wclRateLimitQueryKey(uid),
    queryFn: getWclRateLimitData,
    enabled: false,
    staleTime: rateLimitRefetchIntervalMs,
  })

  return {
    rateLimit: query.data ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    error: query.error,
    refresh: async () => {
      if (!canQuery) {
        return
      }
      await query.refetch()
    },
  }
}
