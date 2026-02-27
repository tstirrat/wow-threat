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

/** Return a stable, unique, sorted actor-id list. */
export function normalizeIdList(ids: number[]): number[] {
  return [...new Set(ids)].sort((left, right) => left - right)
}

export interface UseFightPageInteractionsResult {
  handleFocusAndAddPlayer: (playerId: number) => void
  handleFocusAndIsolatePlayer: (playerId: number) => void
  handleInferThreatReductionChange: (inferThreatReduction: boolean) => void
  handleSeriesClick: (playerId: number) => void
  handleShowBossMeleeChange: (showBossMelee: boolean) => void
  handleShowEnergizeEventsChange: (showEnergizeEvents: boolean) => void
  handleShowPetsChange: (showPets: boolean) => void
  handleTogglePinnedPlayer: (playerId: number) => void
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
    | 'setFocusAndPlayers'
    | 'setFocusId'
    | 'setPinnedPlayersAndPlayers'
    | 'setPlayers'
    | 'setTarget'
    | 'setWindow'
    | 'state'
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

  const handleFocusAndIsolatePlayer = useCallback(
    (playerId: number): void => {
      queryState.setFocusAndPlayers(playerId, [playerId])
    },
    [queryState],
  )

  const handleFocusAndAddPlayer = useCallback(
    (playerId: number): void => {
      if (!validPlayerIds.has(playerId)) {
        return
      }

      const allPlayerIds = normalizeIdList([...validPlayerIds])
      const currentPlayers =
        queryState.state.players.length === 0
          ? allPlayerIds
          : normalizeIdList(queryState.state.players)
      const nextPlayers = currentPlayers.includes(playerId)
        ? currentPlayers
        : normalizeIdList([...currentPlayers, playerId])
      const normalizedNextPlayers = areEqualIdLists(nextPlayers, allPlayerIds)
        ? []
        : nextPlayers

      queryState.setFocusAndPlayers(playerId, normalizedNextPlayers)
    },
    [queryState, validPlayerIds],
  )

  const handleVisiblePlayerIdsChange = useCallback(
    (visiblePlayerIds: number[]): void => {
      const pinnedPlayerIds = normalizeIdList(queryState.state.pinnedPlayers)
      if (pinnedPlayerIds.length > 0) {
        const currentPlayers = normalizeIdList(queryState.state.players)
        if (!areEqualIdLists(currentPlayers, pinnedPlayerIds)) {
          queryState.setPlayers(pinnedPlayerIds)
        }
        return
      }

      const allPlayerIds = normalizeIdList([...validPlayerIds])
      const normalizedVisiblePlayerIds = normalizeIdList(visiblePlayerIds)
      const nextPlayers = areEqualIdLists(
        normalizedVisiblePlayerIds,
        allPlayerIds,
      )
        ? []
        : normalizedVisiblePlayerIds

      const currentPlayers = normalizeIdList(queryState.state.players)
      if (areEqualIdLists(currentPlayers, nextPlayers)) {
        return
      }

      queryState.setPlayers(nextPlayers)
    },
    [queryState, validPlayerIds],
  )

  const handleTogglePinnedPlayer = useCallback(
    (playerId: number): void => {
      if (!validPlayerIds.has(playerId)) {
        return
      }

      const currentPinnedPlayerIds = normalizeIdList(
        queryState.state.pinnedPlayers.filter((id) => validPlayerIds.has(id)),
      )
      const nextPinnedPlayerIds = currentPinnedPlayerIds.includes(playerId)
        ? currentPinnedPlayerIds.filter((id) => id !== playerId)
        : normalizeIdList([...currentPinnedPlayerIds, playerId])

      queryState.setPinnedPlayersAndPlayers(
        nextPinnedPlayerIds,
        nextPinnedPlayerIds.length > 0 ? nextPinnedPlayerIds : [],
      )
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
    handleFocusAndAddPlayer,
    handleFocusAndIsolatePlayer,
    handleInferThreatReductionChange,
    handleSeriesClick,
    handleShowBossMeleeChange,
    handleShowEnergizeEventsChange,
    handleShowPetsChange,
    handleTogglePinnedPlayer,
    handleTargetChange,
    handleVisiblePlayerIdsChange,
    handleWindowChange,
  }
}
