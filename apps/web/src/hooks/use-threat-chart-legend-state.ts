/**
 * Legend visibility and isolate state for the threat chart.
 */
import { useCallback, useMemo, useState } from 'react'

import type { ThreatSeries } from '../types/app'

export interface UseThreatChartLegendStateResult {
  visibleSeries: ThreatSeries[]
  visibleIsolatedActorId: number | null
  isActorVisible: (actorId: number) => boolean
  clearIsolate: () => void
  toggleActorVisibility: (actorId: number) => void
  isolateActor: (actorId: number) => void
  setVisibleActors: (actorIds: number[]) => void
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
      // Pets are only in the series when "Show pets" is on, so they stay visible
      // regardless of which players are selected.
      .filter(
        (item) =>
          item.actorType === 'Player' && !selectedPlayers.has(item.actorId),
      )
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

/** Manage per-actor visibility toggles and isolate state for the chart roster. */
export function useThreatChartLegendState(
  series: ThreatSeries[],
  selectedPlayerIds: number[] = [],
): UseThreatChartLegendStateResult {
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

  const isolateActor = useCallback((actorId: number): void => {
    setVisibilityOverrides(createEmptyVisibilityOverrides())
    setIsolatedActorId((previous) => (previous === actorId ? null : actorId))
  }, [])

  const setVisibleActors = useCallback(
    (actorIds: number[]): void => {
      const wanted = new Set(actorIds)
      setIsolatedActorId(null)
      setVisibilityOverrides({
        hiddenActorIds: new Set(
          series
            .map((item) => item.actorId)
            .filter((actorId) => !wanted.has(actorId)),
        ),
        shownActorIds: new Set(actorIds),
      })
    },
    [series],
  )

  const clearIsolate = useCallback((): void => {
    setVisibilityOverrides(createEmptyVisibilityOverrides())
    setIsolatedActorId(null)
  }, [])

  return {
    visibleSeries,
    visibleIsolatedActorId,
    isActorVisible,
    clearIsolate,
    toggleActorVisibility,
    isolateActor,
    setVisibleActors,
  }
}
