/**
 * Interaction handlers for fight-page chart controls and query state updates.
 */
import { useCallback, useRef } from 'react'

import type { UseFightQueryStateResult } from '../../hooks/use-fight-query-state'
import type { UseUserSettingsResult } from '../../hooks/use-user-settings'
import type { BossDamageMode } from '../../types/app'

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
  handleToggleFocusedPlayerIsolation: (playerId: number) => void
  handleBossDamageModeChange: (bossDamageMode: BossDamageMode) => void
  handleClearSelections: () => void
  handleInferThreatReductionChange: (inferThreatReduction: boolean) => void
  handleSeriesClick: (playerId: number) => void
  handleShowFixateBandsChange: (showFixateBands: boolean) => void
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
    | 'setPinnedPlayers'
    | 'setPlayers'
    | 'setTarget'
    | 'setWindow'
    | 'state'
  >
  updateUserSettings: UseUserSettingsResult['updateSettings']
  validPlayerIds: Set<number>
}): UseFightPageInteractionsResult {
  const previousPlayerSelectionRef = useRef<number[] | null>(null)
  const isolatedPlayerIdRef = useRef<number | null>(null)

  const clearIsolateToggleState = useCallback((): void => {
    previousPlayerSelectionRef.current = null
    isolatedPlayerIdRef.current = null
  }, [])

  const handleTargetChange = useCallback(
    (target: { id: number; instance: number }): void => {
      queryState.setTarget(target)
    },
    [queryState],
  )

  const handleSeriesClick = useCallback(
    (playerId: number): void => {
      clearIsolateToggleState()
      queryState.setFocusId(playerId)
    },
    [clearIsolateToggleState, queryState],
  )

  const handleFocusAndIsolatePlayer = useCallback(
    (playerId: number): void => {
      clearIsolateToggleState()
      queryState.setFocusAndPlayers(playerId, [playerId])
    },
    [clearIsolateToggleState, queryState],
  )

  const handleToggleFocusedPlayerIsolation = useCallback(
    (playerId: number): void => {
      if (!validPlayerIds.has(playerId)) {
        return
      }

      const normalizedPlayers = normalizeIdList(
        queryState.state.players.filter((id) => validPlayerIds.has(id)),
      )
      const isFocusedPlayerIsolated =
        normalizedPlayers.length === 1 && normalizedPlayers[0] === playerId

      if (isFocusedPlayerIsolated) {
        const previousPlayerSelection =
          isolatedPlayerIdRef.current === playerId &&
          previousPlayerSelectionRef.current !== null
            ? previousPlayerSelectionRef.current
            : []
        clearIsolateToggleState()
        queryState.setFocusAndPlayers(playerId, previousPlayerSelection)
        return
      }

      previousPlayerSelectionRef.current = normalizedPlayers
      isolatedPlayerIdRef.current = playerId
      queryState.setFocusAndPlayers(playerId, [playerId])
    },
    [clearIsolateToggleState, queryState, validPlayerIds],
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

      clearIsolateToggleState()
      queryState.setFocusAndPlayers(playerId, normalizedNextPlayers)
    },
    [clearIsolateToggleState, queryState, validPlayerIds],
  )

  const handleClearSelections = useCallback((): void => {
    clearIsolateToggleState()
    queryState.setPlayers([])
  }, [clearIsolateToggleState, queryState])

  const handleVisiblePlayerIdsChange = useCallback(
    (visiblePlayerIds: number[]): void => {
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

      clearIsolateToggleState()
      queryState.setPlayers(nextPlayers)
    },
    [clearIsolateToggleState, queryState, validPlayerIds],
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

      queryState.setPinnedPlayers(nextPinnedPlayerIds)
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

  const handleShowFixateBandsChange = useCallback(
    (showFixateBands: boolean): void => {
      void updateUserSettings({
        showFixateBands,
      })
    },
    [updateUserSettings],
  )

  const handleBossDamageModeChange = useCallback(
    (bossDamageMode: BossDamageMode): void => {
      void updateUserSettings({
        showBossMelee: bossDamageMode !== 'off',
        showAllBossDamageEvents: bossDamageMode === 'all',
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
    handleClearSelections,
    handleFocusAndAddPlayer,
    handleFocusAndIsolatePlayer,
    handleToggleFocusedPlayerIsolation,
    handleBossDamageModeChange,
    handleInferThreatReductionChange,
    handleSeriesClick,
    handleShowFixateBandsChange,
    handleShowEnergizeEventsChange,
    handleShowPetsChange,
    handleTogglePinnedPlayer,
    handleTargetChange,
    handleVisiblePlayerIdsChange,
    handleWindowChange,
  }
}
