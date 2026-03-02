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
  fightRawEventsQueryKey,
  getFight,
  getReport,
  reportQueryKey,
} from '../api/reports'
import {
  getFightEventsClientSide,
  getFightRawEventsClientSide,
} from '../lib/client-threat-engine'
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
  forceFresh: boolean
  queryClient: QueryClient
  signal?: AbortSignal
  onProgressMessage?: (message: string) => void
}): Promise<AugmentedEventsResponse> {
  const {
    reportId,
    fightId,
    inferThreatReduction,
    forceFresh,
    queryClient,
    signal,
    onProgressMessage,
  } = params
  throwIfAborted(signal)

  if (!forceFresh) {
    const cached = await loadFightEventsResultCache({
      reportCode: reportId,
      fightId,
      configVersion: configCacheVersion,
      inferThreatReduction,
    })
    if (cached) {
      onProgressMessage?.(
        `Loaded cached events (${cached.events.length} events)`,
      )
      return cached
    }
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
  const rawEventsData = forceFresh
    ? await getFightRawEventsClientSide({
        reportId,
        fightId,
        signal,
        onProgress: (progress) => {
          onProgressMessage?.(progress.message)
        },
      })
    : await queryClient.ensureQueryData({
        queryKey: fightRawEventsQueryKey(reportId, fightId),
        queryFn: ({ signal: rawEventsSignal }) =>
          getFightRawEventsClientSide({
            reportId,
            fightId,
            signal: rawEventsSignal,
            onProgress: (progress) => {
              onProgressMessage?.(progress.message)
            },
          }),
      })
  throwIfAborted(signal)

  const response = await getFightEventsClientSide({
    reportId,
    fightId,
    reportData,
    fightData,
    inferThreatReduction,
    rawEventsData,
    signal,
    onProgress: (progress) => {
      onProgressMessage?.(progress.message)
    },
  })

  if (!forceFresh) {
    await saveFightEventsResultCache({
      key: {
        reportCode: reportId,
        fightId,
        configVersion: response.configVersion,
        inferThreatReduction,
      },
      response,
    })
  }

  return response
}

/** Fetch and cache fight events. */
export function useFightEvents(
  reportId: string,
  fightId: number,
  inferThreatReduction: boolean,
  enabled = true,
  forceFresh = false,
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
      forceFresh,
    )
    return () => {
      activeRequestIdRef.current += 1
      void queryClient.cancelQueries({
        queryKey,
      })
    }
  }, [queryClient, reportId, fightId, inferThreatReduction, forceFresh])

  const query = useQuery({
    queryKey: fightEventsQueryKey(
      reportId,
      fightId,
      inferThreatReduction,
      forceFresh,
    ),
    queryFn: ({ signal }) => {
      const requestId = activeRequestIdRef.current + 1
      activeRequestIdRef.current = requestId
      setLoadingMessage(defaultFightEventsLoadingMessage)

      return fetchFightEvents({
        reportId,
        fightId,
        inferThreatReduction,
        forceFresh,
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
    placeholderData: (previousData) => {
      if (forceFresh) {
        return undefined
      }

      if (
        previousData?.reportCode === reportId &&
        previousData.fightId === fightId
      ) {
        return previousData
      }

      return undefined
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
  forceFresh = false,
): {
  data: AugmentedEventsResponse
} {
  const queryClient = useQueryClient()
  const query = useSuspenseQuery({
    queryKey: fightEventsQueryKey(
      reportId,
      fightId,
      inferThreatReduction,
      forceFresh,
    ),
    queryFn: ({ signal }) =>
      fetchFightEvents({
        reportId,
        fightId,
        inferThreatReduction,
        forceFresh,
        queryClient,
        signal,
      }),
  })

  return {
    data: query.data,
  }
}
