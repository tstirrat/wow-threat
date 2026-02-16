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

interface LegendVisibilityOverrides {
  hiddenActorIds: Set<number>
  shownActorIds: Set<number>
}

function resolveDefaultHiddenActorIds(
  series: ThreatSeries[],
  selectedPlayerIds: number[],
): Set<number> {
  if (selectedPlayerIds.length === 0) {
    return new Set()
  }

  const selectedPlayers = new Set(selectedPlayerIds)

  return new Set(
    series
      .filter((item) => {
        const playerId =
          item.actorType === 'Player' ? item.actorId : item.ownerId

        return playerId === null || !selectedPlayers.has(playerId)
      })
      .map((item) => item.actorId),
  )
}

function createEmptyVisibilityOverrides(): LegendVisibilityOverrides {
  return {
    hiddenActorIds: new Set(),
    shownActorIds: new Set(),
  }
}

function isActorVisibleWithOverrides({
  actorId,
  defaultHiddenActorIds,
  hiddenActorIds,
  shownActorIds,
  isolatedActorId,
}: {
  actorId: number
  defaultHiddenActorIds: Set<number>
  hiddenActorIds: Set<number>
  shownActorIds: Set<number>
  isolatedActorId: number | null
}): boolean {
  if (isolatedActorId !== null) {
    return actorId === isolatedActorId
  }

  if (shownActorIds.has(actorId)) {
    return true
  }

  if (hiddenActorIds.has(actorId)) {
    return false
  }

  return !defaultHiddenActorIds.has(actorId)
}

/** Manage single-click toggle and double-click isolate behavior for chart legend items. */
export function useThreatChartLegendState(
  series: ThreatSeries[],
  selectedPlayerIds: number[] = [],
): UseThreatChartLegendStateResult {
  const pendingLegendClickRef = useRef<{
    actorId: number
    timeoutId: ReturnType<typeof setTimeout>
  } | null>(null)
  const [isolatedActorId, setIsolatedActorId] = useState<number | null>(null)
  const [visibilityOverrides, setVisibilityOverrides] =
    useState<LegendVisibilityOverrides>(() => createEmptyVisibilityOverrides())
  const defaultHiddenActorIds = useMemo(
    () => resolveDefaultHiddenActorIds(series, selectedPlayerIds),
    [selectedPlayerIds, series],
  )

  const visibleIsolatedActorId =
    isolatedActorId !== null &&
    series.some((item) => item.actorId === isolatedActorId)
      ? isolatedActorId
      : null

  const isActorVisible = useCallback(
    (actorId: number): boolean => {
      return isActorVisibleWithOverrides({
        actorId,
        defaultHiddenActorIds,
        hiddenActorIds: visibilityOverrides.hiddenActorIds,
        shownActorIds: visibilityOverrides.shownActorIds,
        isolatedActorId: visibleIsolatedActorId,
      })
    },
    [defaultHiddenActorIds, visibilityOverrides, visibleIsolatedActorId],
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
      setVisibilityOverrides((previous) => {
        const nextHiddenActorIds = new Set(previous.hiddenActorIds)
        const nextShownActorIds = new Set(previous.shownActorIds)
        const currentlyVisible = isActorVisibleWithOverrides({
          actorId,
          defaultHiddenActorIds,
          hiddenActorIds: previous.hiddenActorIds,
          shownActorIds: previous.shownActorIds,
          isolatedActorId: null,
        })

        if (currentlyVisible) {
          nextShownActorIds.delete(actorId)
          nextHiddenActorIds.add(actorId)
        } else {
          nextHiddenActorIds.delete(actorId)
          if (defaultHiddenActorIds.has(actorId)) {
            nextShownActorIds.add(actorId)
          } else {
            nextShownActorIds.delete(actorId)
          }
        }

        return {
          hiddenActorIds: nextHiddenActorIds,
          shownActorIds: nextShownActorIds,
        }
      })
    },
    [defaultHiddenActorIds],
  )

  const isolateActorVisibility = useCallback((actorId: number): void => {
    setVisibilityOverrides(createEmptyVisibilityOverrides())
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
    setVisibilityOverrides(createEmptyVisibilityOverrides())
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
