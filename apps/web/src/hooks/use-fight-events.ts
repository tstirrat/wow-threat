/**
 * Query hook for a fight's augmented event timeline.
 */
import {
  type QueryClient,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

import {
  fightEventsQueryKey,
  fightQueryKey,
  getFight,
  getReport,
  reportQueryKey,
} from '../api/reports'
import { getFightEventsClientSide } from '../lib/client-threat-engine'
import { useClientThreatEngine } from '../lib/constants'
import type { AugmentedEventsResponse } from '../types/api'

async function fetchFightEvents(params: {
  reportId: string
  fightId: number
  inferThreatReduction: boolean
  queryClient: QueryClient
}): Promise<AugmentedEventsResponse> {
  const { reportId, fightId, inferThreatReduction, queryClient } = params

  const [reportData, fightData] = await Promise.all([
    queryClient.ensureQueryData({
      queryKey: reportQueryKey(reportId),
      queryFn: () => getReport(reportId),
    }),
    queryClient.ensureQueryData({
      queryKey: fightQueryKey(reportId, fightId),
      queryFn: () => getFight(reportId, fightId),
    }),
  ])

  return getFightEventsClientSide({
    reportId,
    fightId,
    reportData,
    fightData,
    inferThreatReduction,
    preferWorker: useClientThreatEngine,
  })
}

/** Fetch and cache fight events. */
export function useFightEvents(
  reportId: string,
  fightId: number,
  inferThreatReduction: boolean,
  enabled = true,
): {
  data: AugmentedEventsResponse | undefined
  isLoading: boolean
  error: Error | null
} {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: fightEventsQueryKey(
      reportId,
      fightId,
      inferThreatReduction,
      'client',
    ),
    queryFn: () =>
      fetchFightEvents({
        reportId,
        fightId,
        inferThreatReduction,
        queryClient,
      }),
    enabled: reportId.length > 0 && Number.isFinite(fightId) && enabled,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  }
}

/** Fetch and cache fight events with React Suspense integration. */
export function useSuspenseFightEvents(
  reportId: string,
  fightId: number,
  inferThreatReduction: boolean,
): {
  data: AugmentedEventsResponse
} {
  const queryClient = useQueryClient()
  const query = useSuspenseQuery({
    queryKey: fightEventsQueryKey(
      reportId,
      fightId,
      inferThreatReduction,
      'client',
    ),
    queryFn: () =>
      fetchFightEvents({
        reportId,
        fightId,
        inferThreatReduction,
        queryClient,
      }),
  })

  return {
    data: query.data,
  }
}
