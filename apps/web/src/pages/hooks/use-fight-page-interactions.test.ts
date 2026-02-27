/**
 * Unit tests for fight-page interaction handler hook.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { FightQueryState } from '../../types/app'
import {
  areEqualIdLists,
  useFightPageInteractions,
} from './use-fight-page-interactions'

function createQueryStateState(
  overrides: Partial<FightQueryState> = {},
): FightQueryState {
  return {
    players: [],
    focusId: null,
    targetId: null,
    targetInstance: null,
    startMs: null,
    endMs: null,
    ...overrides,
  }
}

function createQueryState({
  state = createQueryStateState(),
}: {
  state?: FightQueryState
} = {}) {
  return {
    state,
    setFocusAndPlayers: vi.fn(),
    setFocusId: vi.fn(),
    setPlayers: vi.fn(),
    setTarget: vi.fn(),
    setWindow: vi.fn(),
  }
}

describe('useFightPageInteractions', () => {
  it('compares actor-id lists by value and order', () => {
    expect(areEqualIdLists([], [])).toBe(true)
    expect(areEqualIdLists([1, 2], [1, 2])).toBe(true)
    expect(areEqualIdLists([1, 2], [2, 1])).toBe(false)
    expect(areEqualIdLists([1], [1, 2])).toBe(false)
  })

  it('maps visible players to query param players with full-list collapse', () => {
    const queryState = createQueryState({
      state: createQueryStateState({
        players: [2, 1],
      }),
    })

    const { result } = renderHook(() =>
      useFightPageInteractions({
        queryState,
        updateUserSettings: vi.fn().mockResolvedValue(undefined),
        validPlayerIds: new Set([1, 2, 3]),
      }),
    )

    act(() => {
      result.current.handleVisiblePlayerIdsChange([1, 2, 3])
    })
    expect(queryState.setPlayers).toHaveBeenCalledWith([])

    act(() => {
      result.current.handleVisiblePlayerIdsChange([1, 2])
    })
    expect(queryState.setPlayers).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.handleVisiblePlayerIdsChange([1])
    })
    expect(queryState.setPlayers).toHaveBeenCalledWith([1])
  })

  it('adds focused player to current filtered players list', () => {
    const queryState = createQueryState({
      state: createQueryStateState({
        players: [1],
      }),
    })

    const { result } = renderHook(() =>
      useFightPageInteractions({
        queryState,
        updateUserSettings: vi.fn().mockResolvedValue(undefined),
        validPlayerIds: new Set([1, 2, 3]),
      }),
    )

    act(() => {
      result.current.handleFocusAndAddPlayer(2)
    })

    expect(queryState.setFocusAndPlayers).toHaveBeenCalledWith(2, [1, 2])
  })

  it('keeps all players visible when adding from unfiltered state', () => {
    const queryState = createQueryState({
      state: createQueryStateState({
        players: [],
      }),
    })

    const { result } = renderHook(() =>
      useFightPageInteractions({
        queryState,
        updateUserSettings: vi.fn().mockResolvedValue(undefined),
        validPlayerIds: new Set([1, 2, 3]),
      }),
    )

    act(() => {
      result.current.handleFocusAndAddPlayer(2)
    })

    expect(queryState.setFocusAndPlayers).toHaveBeenCalledWith(2, [])
  })

  it('forwards chart and settings interactions to query state and settings updates', () => {
    const queryState = createQueryState()
    const updateUserSettings = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useFightPageInteractions({
        queryState,
        updateUserSettings,
        validPlayerIds: new Set([1]),
      }),
    )

    act(() => {
      result.current.handleTargetChange({ id: 99, instance: 2 })
      result.current.handleSeriesClick(7)
      result.current.handleFocusAndIsolatePlayer(1)
      result.current.handleWindowChange(1000, 5000)
      result.current.handleShowPetsChange(true)
      result.current.handleShowEnergizeEventsChange(true)
      result.current.handleShowBossMeleeChange(false)
      result.current.handleInferThreatReductionChange(true)
    })

    expect(queryState.setTarget).toHaveBeenCalledWith({ id: 99, instance: 2 })
    expect(queryState.setFocusId).toHaveBeenCalledWith(7)
    expect(queryState.setFocusAndPlayers).toHaveBeenCalledWith(1, [1])
    expect(queryState.setWindow).toHaveBeenCalledWith(1000, 5000)
    expect(updateUserSettings).toHaveBeenNthCalledWith(1, { showPets: true })
    expect(updateUserSettings).toHaveBeenNthCalledWith(2, {
      showEnergizeEvents: true,
    })
    expect(updateUserSettings).toHaveBeenNthCalledWith(3, {
      showBossMelee: false,
    })
    expect(updateUserSettings).toHaveBeenNthCalledWith(4, {
      inferThreatReduction: true,
    })
  })
})
