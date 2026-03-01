/**
 * Query hook for a fight's augmented event timeline.
 */
import {
  type QueryClient,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { configCacheVersion } from '@wow-threat/config'
import { useEffect, useRef, useState } from 'react'

import {
  fightEventsQueryKey,
  fightQueryKey,
  getFight,
  getReport,
  reportQueryKey,
} from '../api/reports'
import { getFightEventsClientSide } from '../lib/client-threat-engine'
import { useClientThreatEngine } from '../lib/constants'
import {
  loadFightEventsResultCache,
  saveFightEventsResultCache,
} from '../lib/fight-events-result-cache'
import type { AugmentedEventsResponse } from '../types/api'

const defaultFightEventsLoadingMessage = 'Loading fight events'

function createAbortError(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('Fight event loading was cancelled', 'AbortError')
  }

  const error = new Error('Fight event loading was cancelled')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

async function fetchFightEvents(params: {
  reportId: string
  fightId: number
  inferThreatReduction: boolean
  queryClient: QueryClient
  signal?: AbortSignal
  onProgressMessage?: (message: string) => void
}): Promise<AugmentedEventsResponse> {
  const {
    reportId,
    fightId,
    inferThreatReduction,
    queryClient,
    signal,
    onProgressMessage,
  } = params
  throwIfAborted(signal)

  const cached = await loadFightEventsResultCache({
    reportCode: reportId,
    fightId,
    configVersion: configCacheVersion,
    inferThreatReduction,
  })
  if (cached) {
    onProgressMessage?.(`Loaded cached events (${cached.events.length} events)`)
    return cached
  }

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
  throwIfAborted(signal)

  const response = await getFightEventsClientSide({
    reportId,
    fightId,
    reportData,
    fightData,
    inferThreatReduction,
    preferWorker: useClientThreatEngine,
    signal,
    onProgress: (progress) => {
      onProgressMessage?.(progress.message)
    },
  })

  await saveFightEventsResultCache({
    key: {
      reportCode: reportId,
      fightId,
      configVersion: response.configVersion,
      inferThreatReduction,
    },
    response,
  })

  return response
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
  loadingMessage: string
} {
  const queryClient = useQueryClient()
  const [loadingMessage, setLoadingMessage] = useState(
    defaultFightEventsLoadingMessage,
  )
  const activeRequestIdRef = useRef(0)

  useEffect(() => {
    const queryKey = fightEventsQueryKey(
      reportId,
      fightId,
      inferThreatReduction,
      'client',
    )
    return () => {
      activeRequestIdRef.current += 1
      void queryClient.cancelQueries({
        queryKey,
      })
    }
  }, [queryClient, reportId, fightId, inferThreatReduction])

  const query = useQuery({
    queryKey: fightEventsQueryKey(
      reportId,
      fightId,
      inferThreatReduction,
      'client',
    ),
    queryFn: ({ signal }) => {
      const requestId = activeRequestIdRef.current + 1
      activeRequestIdRef.current = requestId
      setLoadingMessage(defaultFightEventsLoadingMessage)

      return fetchFightEvents({
        reportId,
        fightId,
        inferThreatReduction,
        queryClient,
        signal,
        onProgressMessage: (message) => {
          if (activeRequestIdRef.current !== requestId) {
            return
          }

          setLoadingMessage(message)
        },
      })
    },
    enabled: reportId.length > 0 && Number.isFinite(fightId) && enabled,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    loadingMessage,
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
    queryFn: ({ signal }) =>
      fetchFightEvents({
        reportId,
        fightId,
        inferThreatReduction,
        queryClient,
        signal,
      }),
  })

  return {
    data: query.data,
  }
}
