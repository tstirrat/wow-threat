/**
 * Legend visibility and isolate state for the threat chart.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ThreatSeries } from '../types/app'

const doubleClickThresholdMs = 320

export interface UseThreatChartLegendStateResult {
  visibleSeries: ThreatSeries[]
  visibleIsolatedActorId: number | null
  isActorVisible: (actorId: number) => boolean
  clearIsolate: () => void
  handleLegendItemClick: (actorId: number) => void
}

/** Manage single-click toggle and double-click isolate behavior for chart legend items. */
export function useThreatChartLegendState(
  series: ThreatSeries[],
): UseThreatChartLegendStateResult {
  const pendingLegendClickRef = useRef<{
    actorId: number
    timeoutId: ReturnType<typeof setTimeout>
  } | null>(null)
  const [isolatedActorId, setIsolatedActorId] = useState<number | null>(null)
  const [hiddenActorIds, setHiddenActorIds] = useState<Set<number>>(
    () => new Set(),
  )

  const visibleIsolatedActorId =
    isolatedActorId !== null &&
    series.some((item) => item.actorId === isolatedActorId)
      ? isolatedActorId
      : null

  const isActorVisible = useCallback(
    (actorId: number): boolean => {
      if (visibleIsolatedActorId !== null) {
        return actorId === visibleIsolatedActorId
      }

      return !hiddenActorIds.has(actorId)
    },
    [hiddenActorIds, visibleIsolatedActorId],
  )

  const visibleSeries = useMemo(
    () => series.filter((item) => isActorVisible(item.actorId)),
    [isActorVisible, series],
  )

  const clearPendingLegendClick = useCallback((): void => {
    if (!pendingLegendClickRef.current) {
      return
    }

    clearTimeout(pendingLegendClickRef.current.timeoutId)
    pendingLegendClickRef.current = null
  }, [])

  const toggleActorVisibility = useCallback(
    (actorId: number): void => {
      setIsolatedActorId(null)
      setHiddenActorIds((previous) => {
        const next = new Set(previous)
        if (next.has(actorId)) {
          next.delete(actorId)
        } else {
          next.add(actorId)
        }

        return next
      })
    },
    [setHiddenActorIds],
  )

  const isolateActorVisibility = useCallback((actorId: number): void => {
    setHiddenActorIds(new Set())
    setIsolatedActorId((previous) => (previous === actorId ? null : actorId))
  }, [])

  const handleLegendItemClick = useCallback(
    (actorId: number): void => {
      const pending = pendingLegendClickRef.current
      if (pending && pending.actorId === actorId) {
        clearPendingLegendClick()
        isolateActorVisibility(actorId)
        return
      }

      if (pending) {
        clearPendingLegendClick()
        toggleActorVisibility(pending.actorId)
      }

      const timeoutId = setTimeout(() => {
        toggleActorVisibility(actorId)
        pendingLegendClickRef.current = null
      }, doubleClickThresholdMs)

      pendingLegendClickRef.current = {
        actorId,
        timeoutId,
      }
    },
    [clearPendingLegendClick, isolateActorVisibility, toggleActorVisibility],
  )

  const clearIsolate = useCallback((): void => {
    clearPendingLegendClick()
    setHiddenActorIds(new Set())
    setIsolatedActorId(null)
  }, [clearPendingLegendClick])

  useEffect(
    () => () => {
      clearPendingLegendClick()
    },
    [clearPendingLegendClick],
  )

  return {
    visibleSeries,
    visibleIsolatedActorId,
    isActorVisible,
    clearIsolate,
    handleLegendItemClick,
  }
}
