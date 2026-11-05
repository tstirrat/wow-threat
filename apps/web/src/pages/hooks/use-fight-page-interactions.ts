/**
 * Interaction handlers for fight-page chart controls and query state updates.
 */
import type { PostHog } from 'posthog-js'
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
  handleReplayStateChange: (state: {
    playheadMs?: number | null
    replay?: boolean
  }) => void
  handleSeriesClick: (playerId: number) => void
  handleShowFixateBandsChange: (showFixateBands: boolean) => void
  handleShowRawThreatChange: (showRawThreat: boolean) => void
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
  fightId,
  reportId,
  posthog,
}: {
  queryState: Pick<
    UseFightQueryStateResult,
    | 'setFocusAndPlayers'
    | 'setFocusId'
    | 'setReplayState'
    | 'setPinnedPlayers'
    | 'setPlayers'
    | 'setTarget'
    | 'setWindow'
    | 'state'
  >
  updateUserSettings: UseUserSettingsResult['updateSettings']
  validPlayerIds: Set<number>
  fightId: number
  reportId: string
  posthog?: PostHog
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
      posthog?.capture('player_focused', {
        fight_id: fightId,
        report_id: reportId,
      })
      clearIsolateToggleState()
      queryState.setFocusId(playerId)
    },
    [clearIsolateToggleState, fightId, posthog, queryState, reportId],
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

      posthog?.capture('player_filtered', {
        fight_id: fightId,
        report_id: reportId,
      })
      clearIsolateToggleState()
      queryState.setPlayers(nextPlayers)
    },
    [
      clearIsolateToggleState,
      fightId,
      posthog,
      queryState,
      reportId,
      validPlayerIds,
    ],
  )

  const handleTogglePinnedPlayer = useCallback(
    (playerId: number): void => {
      if (!validPlayerIds.has(playerId)) {
        return
      }

      posthog?.capture('player_pinned', {
        fight_id: fightId,
        report_id: reportId,
      })
      const currentPinnedPlayerIds = normalizeIdList(
        queryState.state.pinnedPlayers.filter((id) => validPlayerIds.has(id)),
      )
      const nextPinnedPlayerIds = currentPinnedPlayerIds.includes(playerId)
        ? currentPinnedPlayerIds.filter((id) => id !== playerId)
        : normalizeIdList([...currentPinnedPlayerIds, playerId])

      queryState.setPinnedPlayers(nextPinnedPlayerIds)
    },
    [fightId, posthog, queryState, reportId, validPlayerIds],
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
      posthog?.capture('energize_events_toggled', {
        fight_id: fightId,
        report_id: reportId,
        enabled: showEnergizeEvents,
      })
      void updateUserSettings({ showEnergizeEvents })
    },
    [fightId, posthog, reportId, updateUserSettings],
  )

  const handleShowFixateBandsChange = useCallback(
    (showFixateBands: boolean): void => {
      void updateUserSettings({ showFixateBands })
    },
    [updateUserSettings],
  )

  const handleShowRawThreatChange = useCallback(
    (showRawThreat: boolean): void => {
      void updateUserSettings({ showRawThreat })
    },
    [updateUserSettings],
  )

  const handleBossDamageModeChange = useCallback(
    (bossDamageMode: BossDamageMode): void => {
      posthog?.capture('boss_damage_mode_changed', {
        fight_id: fightId,
        report_id: reportId,
        mode: bossDamageMode,
      })
      void updateUserSettings({
        showBossMelee: bossDamageMode !== 'off',
        showAllBossDamageEvents: bossDamageMode === 'all',
      })
    },
    [fightId, posthog, reportId, updateUserSettings],
  )

  const handleInferThreatReductionChange = useCallback(
    (inferThreatReduction: boolean): void => {
      posthog?.capture('infer_threat_reduction_toggled', {
        fight_id: fightId,
        report_id: reportId,
        enabled: inferThreatReduction,
      })
      void updateUserSettings({ inferThreatReduction })
    },
    [fightId, posthog, reportId, updateUserSettings],
  )

  const handleReplayStateChange = useCallback(
    (state: { playheadMs?: number | null; replay?: boolean }): void => {
      queryState.setReplayState(state)
    },
    [queryState],
  )

  return {
    handleClearSelections,
    handleFocusAndAddPlayer,
    handleFocusAndIsolatePlayer,
    handleToggleFocusedPlayerIsolation,
    handleBossDamageModeChange,
    handleInferThreatReductionChange,
    handleReplayStateChange,
    handleSeriesClick,
    handleShowFixateBandsChange,
    handleShowRawThreatChange,
    handleShowEnergizeEventsChange,
    handleShowPetsChange,
    handleTogglePinnedPlayer,
    handleTargetChange,
    handleVisiblePlayerIdsChange,
    handleWindowChange,
  }
}
