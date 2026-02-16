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
  setPets: (pets: boolean) => void
  setFocusId: (focusId: number | null) => void
  setTarget: (target: FightTarget | null) => void
  setWindow: (startMs: number | null, endMs: number | null) => void
}

/** Manage fight query params with parsing + normalization rules. */
export function useFightQueryState({
  validPlayerIds,
  validTargetKeys,
  maxDurationMs,
}: {
  validPlayerIds: Set<number>
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
        validTargetKeys,
        maxDurationMs,
      }),
    [maxDurationMs, searchParamsString, validPlayerIds, validTargetKeys],
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

  const setPets = useCallback(
    (pets: boolean): void => {
      setSearchParams((currentSearchParams) =>
        applyFightQueryState(currentSearchParams, { pets }),
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
      setPets,
      setFocusId,
      setTarget,
      setWindow,
    }),
    [setFocusId, setPets, setPlayers, setTarget, setWindow, state],
  )
}
