/**
 * Interaction handlers for fight-page chart controls and query state updates.
 */
import { useCallback } from 'react'

import type { UseFightQueryStateResult } from '../../hooks/use-fight-query-state'
import type { UseUserSettingsResult } from '../../hooks/use-user-settings'

/** Compare two sorted actor-id lists for exact equality. */
export function areEqualIdLists(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((id, index) => id === right[index])
}

export interface UseFightPageInteractionsResult {
  handleInferThreatReductionChange: (inferThreatReduction: boolean) => void
  handleSeriesClick: (playerId: number) => void
  handleShowBossMeleeChange: (showBossMelee: boolean) => void
  handleShowEnergizeEventsChange: (showEnergizeEvents: boolean) => void
  handleShowPetsChange: (showPets: boolean) => void
  handleTargetChange: (target: { id: number; instance: number }) => void
  handleVisiblePlayerIdsChange: (visiblePlayerIds: number[]) => void
  handleWindowChange: (startMs: number | null, endMs: number | null) => void
}

/** Build stable callbacks for fight-page chart interactions and settings toggles. */
export function useFightPageInteractions({
  queryState,
  updateUserSettings,
  validPlayerIds,
}: {
  queryState: Pick<
    UseFightQueryStateResult,
    'setFocusId' | 'setPlayers' | 'setTarget' | 'setWindow' | 'state'
  >
  updateUserSettings: UseUserSettingsResult['updateSettings']
  validPlayerIds: Set<number>
}): UseFightPageInteractionsResult {
  const handleTargetChange = useCallback(
    (target: { id: number; instance: number }): void => {
      queryState.setTarget(target)
    },
    [queryState],
  )

  const handleSeriesClick = useCallback(
    (playerId: number): void => {
      queryState.setFocusId(playerId)
    },
    [queryState],
  )

  const handleVisiblePlayerIdsChange = useCallback(
    (visiblePlayerIds: number[]): void => {
      const allPlayerIds = [...validPlayerIds].sort(
        (left, right) => left - right,
      )
      const nextPlayers = areEqualIdLists(visiblePlayerIds, allPlayerIds)
        ? []
        : visiblePlayerIds

      const currentPlayers = [...queryState.state.players].sort(
        (left, right) => left - right,
      )
      if (areEqualIdLists(currentPlayers, nextPlayers)) {
        return
      }

      queryState.setPlayers(nextPlayers)
    },
    [queryState, validPlayerIds],
  )

  const handleWindowChange = useCallback(
    (startMs: number | null, endMs: number | null): void => {
      queryState.setWindow(startMs, endMs)
    },
    [queryState],
  )

  const handleShowPetsChange = useCallback(
    (showPets: boolean): void => {
      void updateUserSettings({
        showPets,
      })
    },
    [updateUserSettings],
  )

  const handleShowEnergizeEventsChange = useCallback(
    (showEnergizeEvents: boolean): void => {
      void updateUserSettings({
        showEnergizeEvents,
      })
    },
    [updateUserSettings],
  )

  const handleShowBossMeleeChange = useCallback(
    (showBossMelee: boolean): void => {
      void updateUserSettings({
        showBossMelee,
      })
    },
    [updateUserSettings],
  )

  const handleInferThreatReductionChange = useCallback(
    (inferThreatReduction: boolean): void => {
      void updateUserSettings({
        inferThreatReduction,
      })
    },
    [updateUserSettings],
  )

  return {
    handleInferThreatReductionChange,
    handleSeriesClick,
    handleShowBossMeleeChange,
    handleShowEnergizeEventsChange,
    handleShowPetsChange,
    handleTargetChange,
    handleVisiblePlayerIdsChange,
    handleWindowChange,
  }
}
