/**
 * Derive visible player IDs and sync them with chart consumers.
 */
import { useCallback, useEffect, useMemo } from 'react'

import type { ThreatSeries } from '../types/app'

export interface UseThreatChartVisiblePlayersResult {
  allPlayerIds: number[]
  hasHiddenActors: boolean
  handleClearIsolate: () => void
  visiblePlayerIds: number[]
}

/** Track visible player IDs and expose clear-isolate behavior for chart controls. */
export function useThreatChartVisiblePlayers({
  clearIsolate,
  isActorVisible,
  onVisiblePlayerIdsChange,
  series,
}: {
  clearIsolate: () => void
  isActorVisible: (actorId: number) => boolean
  onVisiblePlayerIdsChange?: (playerIds: number[]) => void
  series: ThreatSeries[]
}): UseThreatChartVisiblePlayersResult {
  const visiblePlayerIds = useMemo(
    () =>
      series
        .filter((item) => item.actorType === 'Player')
        .filter((item) => isActorVisible(item.actorId))
        .map((item) => item.actorId)
        .sort((left, right) => left - right),
    [isActorVisible, series],
  )

  const allPlayerIds = useMemo(
    () =>
      series
        .filter((item) => item.actorType === 'Player')
        .map((item) => item.actorId)
        .sort((left, right) => left - right),
    [series],
  )

  const hasHiddenActors = useMemo(
    () => series.some((item) => !isActorVisible(item.actorId)),
    [isActorVisible, series],
  )

  useEffect(() => {
    onVisiblePlayerIdsChange?.(visiblePlayerIds)
  }, [onVisiblePlayerIdsChange, visiblePlayerIds])

  const handleClearIsolate = useCallback((): void => {
    clearIsolate()
    onVisiblePlayerIdsChange?.(allPlayerIds)
  }, [allPlayerIds, clearIsolate, onVisiblePlayerIdsChange])

  return {
    allPlayerIds,
    hasHiddenActors,
    handleClearIsolate,
    visiblePlayerIds,
  }
}
