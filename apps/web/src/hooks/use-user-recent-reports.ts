/**
 * Query hook for merged personal and guild recent reports.
 */
import { useAuth } from '@/auth/auth-provider'
import { useQuery } from '@tanstack/react-query'

import { getRecentReports, recentReportsQueryKey } from '../api/reports'
import type { RecentReportSummary } from '../types/api'

const defaultRecentReportsLimit = 10

export interface UseUserRecentReportsResult {
  reports: RecentReportSummary[]
  isLoading: boolean
  error: Error | null
}

/** Fetch recent reports for the signed-in Warcraft Logs account. */
export function useUserRecentReports(
  limit = defaultRecentReportsLimit,
): UseUserRecentReportsResult {
  const { authEnabled, user } = useAuth()

  const query = useQuery({
    queryKey: recentReportsQueryKey(limit),
    queryFn: async () => {
      const response = await getRecentReports(limit)
      return response.reports
    },
    enabled: authEnabled && Boolean(user),
  })

  return {
    reports: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  }
}
