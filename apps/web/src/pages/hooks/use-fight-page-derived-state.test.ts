/**
 * Unit tests for fight-page derived state selectors.
 */
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { UseFightQueryStateResult } from '../../hooks/use-fight-query-state'
import type { FightsResponse, ReportResponse } from '../../types/api'
import { useFightPageDerivedState } from './use-fight-page-derived-state'

const useFightQueryStateMock = vi.fn()

vi.mock('../../hooks/use-fight-query-state', () => ({
  useFightQueryState: (...args: unknown[]) => useFightQueryStateMock(...args),
}))

function createQueryState(
  overrides: Partial<UseFightQueryStateResult['state']> = {},
): UseFightQueryStateResult {
  return {
    state: {
      players: [],
      pinnedPlayers: [],
      focusId: null,
      targetId: null,
      targetInstance: null,
      startMs: null,
      endMs: null,
      playheadMs: null,
      replay: false,
      ...overrides,
    },
    setPlayers: vi.fn(),
    setPinnedPlayers: vi.fn(),
    setFocusId: vi.fn(),
    setTarget: vi.fn(),
    setWindowBounds: vi.fn(),
    setPlayheadMs: vi.fn(),
    setReplay: vi.fn(),
    setReplayState: vi.fn(),
  }
}

function createFightsResponse(
  overrides: Partial<FightsResponse> = {},
): FightsResponse {
  return {
    id: 1,
    reportCode: 'abc123',
    name: 'Test Fight',
    startTime: 0,
    endTime: 60000,
    kill: true,
    difficulty: null,
    enemies: [],
    actors: [],
    ...overrides,
  }
}

function createReportResponse(
  overrides: Partial<ReportResponse> = {},
): ReportResponse {
  return {
    code: 'abc123',
    title: 'Test Report',
    visibility: 'public',
    owner: 'TestUser',
    guild: null,
    archiveStatus: null,
    startTime: 0,
    endTime: 60000,
    gameVersion: 1,
    threatConfig: null,
    zone: { id: 1, name: 'Molten Core', difficulty: null },
    fights: [],
    actors: [],
    abilities: [],
    ...overrides,
  }
}

describe('useFightPageDerivedState', () => {
  it('returns null selectedTarget when no data available', () => {
    useFightQueryStateMock.mockReturnValue(createQueryState())

    const { result } = renderHook(() =>
      useFightPageDerivedState({
        eventsData: null,
        fightData: null,
        reportData: createReportResponse(),
        showPets: false,
        threatConfig: null,
      }),
    )

    expect(result.current.selectedTarget).toBeNull()
    expect(result.current.allSeries).toEqual([])
    expect(result.current.targetOptions).toEqual([])
  })

  it('selects target from query param when present', () => {
    useFightQueryStateMock.mockReturnValue(
      createQueryState({ targetId: 10, targetInstance: 2 }),
    )

    const { result } = renderHook(() =>
      useFightPageDerivedState({
        eventsData: {
          events: [],
          initialAurasByActor: {},
        } as never,
        fightData: createFightsResponse({
          enemies: [{ id: 10, name: 'Boss', type: 'NPC', subType: 'Boss' }],
        }),
        reportData: createReportResponse(),
        showPets: false,
        threatConfig: null,
      }),
    )

    // Query param wins regardless of default target
    expect(result.current.selectedTarget).toEqual({ id: 10, instance: 2 })
  })

  it('falls back to default target when no query param', () => {
    // No query param — targetId and targetInstance are null
    useFightQueryStateMock.mockReturnValue(
      createQueryState({ targetId: null, targetInstance: null }),
    )

    // Events with threat toward enemy id=10 to make it the default target.
    // Must be proper AugmentedEvent shape with threat.calculation present.
    const events = [
      {
        timestamp: 1000,
        type: 'damage',
        sourceID: 1,
        targetID: 10,
        targetInstance: 1,
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 1,
              operator: 'add',
              amount: 500,
              total: 500,
            },
          ],
          calculation: {
            amount: 500,
            baseThreat: 500,
            modifiedThreat: 500,
            isSplit: false,
            modifiers: [],
          },
        },
      },
    ] as never

    const { result } = renderHook(() =>
      useFightPageDerivedState({
        eventsData: {
          events,
          initialAurasByActor: {},
        } as never,
        fightData: createFightsResponse({
          enemies: [{ id: 10, name: 'Boss', type: 'NPC', subType: 'Boss' }],
          actors: [
            { id: 1, name: 'Tank', type: 'Player', subType: 'Warrior' },
            { id: 10, name: 'Boss', type: 'NPC', subType: 'Boss' },
          ],
        }),
        reportData: createReportResponse(),
        showPets: false,
        threatConfig: null,
      }),
    )

    expect(result.current.selectedTarget).toEqual({ id: 10, instance: 1 })
  })

  it('returns durationMs from fight data when positive', () => {
    useFightQueryStateMock.mockReturnValue(createQueryState())

    const { result } = renderHook(() =>
      useFightPageDerivedState({
        eventsData: { events: [], initialAurasByActor: {} } as never,
        fightData: createFightsResponse({ startTime: 1000, endTime: 61000 }),
        reportData: createReportResponse(),
        showPets: false,
        threatConfig: null,
      }),
    )

    expect(result.current.durationMs).toBe(60000)
  })

  it('returns durationMs of 0 when fight data is missing', () => {
    useFightQueryStateMock.mockReturnValue(createQueryState())

    const { result } = renderHook(() =>
      useFightPageDerivedState({
        eventsData: null,
        fightData: null,
        reportData: createReportResponse(),
        showPets: false,
        threatConfig: null,
      }),
    )

    expect(result.current.durationMs).toBe(0)
  })

  it('includes valid player ids from fight actors', () => {
    useFightQueryStateMock.mockReturnValue(createQueryState())

    const { result } = renderHook(() =>
      useFightPageDerivedState({
        eventsData: { events: [], initialAurasByActor: {} } as never,
        fightData: createFightsResponse({
          actors: [
            { id: 1, name: 'Tank', type: 'Player', subType: 'Warrior' },
            { id: 2, name: 'Healer', type: 'Player', subType: 'Priest' },
            { id: 10, name: 'Boss', type: 'NPC', subType: 'Boss' },
          ],
        }),
        reportData: createReportResponse(),
        showPets: false,
        threatConfig: null,
      }),
    )

    expect(result.current.validPlayerIds).toEqual(new Set([1, 2]))
  })
})
