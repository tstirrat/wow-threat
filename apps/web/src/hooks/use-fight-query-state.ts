/**
 * Hook for reading and updating fight deep-link query state.
 */
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  applyFightQueryState,
  resolveFightQueryState,
} from '../lib/search-params'
import type { FightQueryState, FightTarget } from '../types/app'

export interface UseFightQueryStateResult {
  state: FightQueryState
  setPlayers: (players: number[]) => void
  setFocusId: (focusId: number | null) => void
  setFocusAndPlayers: (focusId: number | null, players: number[]) => void
  setTarget: (target: FightTarget | null) => void
  setWindow: (startMs: number | null, endMs: number | null) => void
}

/** Manage fight query params with parsing + normalization rules. */
export function useFightQueryState({
  validPlayerIds,
  validActorIds,
  validTargetKeys,
  maxDurationMs,
}: {
  validPlayerIds: Set<number>
  validActorIds: Set<number>
  validTargetKeys: Set<string>
  maxDurationMs: number
}): UseFightQueryStateResult {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsString = searchParams.toString()

  const state = useMemo(
    () =>
      resolveFightQueryState({
        searchParams: new URLSearchParams(searchParamsString),
        validPlayerIds,
        validActorIds,
        validTargetKeys,
        maxDurationMs,
      }),
    [
      maxDurationMs,
      searchParamsString,
      validActorIds,
      validPlayerIds,
      validTargetKeys,
    ],
  )

  const setPlayers = useCallback(
    (players: number[]): void => {
      setSearchParams((currentSearchParams) =>
        applyFightQueryState(currentSearchParams, { players }),
      )
    },
    [setSearchParams],
  )

  const setTarget = useCallback(
    (target: FightTarget | null): void => {
      setSearchParams((currentSearchParams) =>
        applyFightQueryState(currentSearchParams, {
          targetId: target?.id ?? null,
          targetInstance: target?.instance ?? null,
        }),
      )
    },
    [setSearchParams],
  )

  const setFocusId = useCallback(
    (focusId: number | null): void => {
      setSearchParams((currentSearchParams) =>
        applyFightQueryState(currentSearchParams, { focusId }),
      )
    },
    [setSearchParams],
  )

  const setFocusAndPlayers = useCallback(
    (focusId: number | null, players: number[]): void => {
      setSearchParams((currentSearchParams) =>
        applyFightQueryState(currentSearchParams, {
          focusId,
          players,
        }),
      )
    },
    [setSearchParams],
  )

  const setWindow = useCallback(
    (startMs: number | null, endMs: number | null): void => {
      setSearchParams((currentSearchParams) =>
        applyFightQueryState(currentSearchParams, { startMs, endMs }),
      )
    },
    [setSearchParams],
  )

  return useMemo(
    () => ({
      state,
      setPlayers,
      setFocusId,
      setFocusAndPlayers,
      setTarget,
      setWindow,
    }),
    [setFocusAndPlayers, setFocusId, setPlayers, setTarget, setWindow, state],
  )
}
