/**
 * Query hook for a fight's augmented event timeline.
 */
import {
  type QueryClient,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { type ThreatConfigId, configCacheVersion } from '@wow-threat/config'
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
import { threatConfigCacheScope } from '../lib/threat-config'
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
  configId: ThreatConfigId | null
  reportId: string
  fightId: number
  inferThreatReduction: boolean
  forceFresh: boolean
  forceLegacyWorkerMode: boolean
  queryClient: QueryClient
  signal?: AbortSignal
  onProgressMessage?: (message: string) => void
}): Promise<AugmentedEventsResponse> {
  const {
    configId,
    reportId,
    fightId,
    inferThreatReduction,
    forceFresh,
    forceLegacyWorkerMode,
    queryClient,
    signal,
    onProgressMessage,
  } = params
  const configScope = threatConfigCacheScope(configId)
  throwIfAborted(signal)

  if (!forceFresh) {
    const cached = await loadFightEventsResultCache({
      reportCode: reportId,
      fightId,
      configVersion: configCacheVersion,
      inferThreatReduction,
      configScope,
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
        configId,
        reportId,
        fightId,
        signal,
        onProgress: (progress) => {
          onProgressMessage?.(progress.message)
        },
      })
    : await queryClient.ensureQueryData({
        queryKey: fightRawEventsQueryKey(reportId, fightId, configScope),
        queryFn: ({ signal: rawEventsSignal }) =>
          getFightRawEventsClientSide({
            configId,
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
    configId,
    reportId,
    fightId,
    reportData,
    fightData,
    inferThreatReduction,
    forceLegacyWorkerMode,
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
        configScope,
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
  forceLegacyWorkerMode = false,
  configId: ThreatConfigId | null = null,
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
  const configScope = threatConfigCacheScope(configId)

  useEffect(() => {
    const queryKey = fightEventsQueryKey(
      reportId,
      fightId,
      inferThreatReduction,
      forceFresh,
      forceLegacyWorkerMode,
      configScope,
    )
    return () => {
      activeRequestIdRef.current += 1
      void queryClient.cancelQueries({
        queryKey,
      })
    }
  }, [
    configScope,
    queryClient,
    reportId,
    fightId,
    inferThreatReduction,
    forceFresh,
    forceLegacyWorkerMode,
  ])

  const query = useQuery({
    queryKey: fightEventsQueryKey(
      reportId,
      fightId,
      inferThreatReduction,
      forceFresh,
      forceLegacyWorkerMode,
      configScope,
    ),
    queryFn: ({ signal }) => {
      const requestId = activeRequestIdRef.current + 1
      activeRequestIdRef.current = requestId
      setLoadingMessage(defaultFightEventsLoadingMessage)

      return fetchFightEvents({
        configId,
        reportId,
        fightId,
        inferThreatReduction,
        forceFresh,
        forceLegacyWorkerMode,
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
        previousData.fightId === fightId &&
        (previousData.forcedConfigId ?? null) === configId
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
  forceLegacyWorkerMode = false,
  configId: ThreatConfigId | null = null,
): {
  data: AugmentedEventsResponse
} {
  const queryClient = useQueryClient()
  const configScope = threatConfigCacheScope(configId)
  const query = useSuspenseQuery({
    queryKey: fightEventsQueryKey(
      reportId,
      fightId,
      inferThreatReduction,
      forceFresh,
      forceLegacyWorkerMode,
      configScope,
    ),
    queryFn: ({ signal }) =>
      fetchFightEvents({
        configId,
        reportId,
        fightId,
        inferThreatReduction,
        forceFresh,
        forceLegacyWorkerMode,
        queryClient,
        signal,
      }),
  })

  return {
    data: query.data,
  }
}
