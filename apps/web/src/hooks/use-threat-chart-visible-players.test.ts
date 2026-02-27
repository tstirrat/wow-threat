/**
 * Unit tests for threat-chart visible-player synchronization hook.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ThreatSeries } from '../types/app'
import { useThreatChartVisiblePlayers } from './use-threat-chart-visible-players'

function createSeries(
  overrides: Partial<ThreatSeries> &
    Pick<ThreatSeries, 'actorId' | 'actorType' | 'label'>,
): ThreatSeries {
  return {
    actorId: overrides.actorId,
    actorName: overrides.label,
    actorClass: null,
    actorType: overrides.actorType,
    ownerId: null,
    label: overrides.label,
    color: '#c79c6e',
    points: [],
    maxThreat: 0,
    totalThreat: 0,
    totalDamage: 0,
    totalHealing: 0,
    stateVisualSegments: [],
    fixateWindows: [],
    invulnerabilityWindows: [],
    ...overrides,
  }
}

describe('useThreatChartVisiblePlayers', () => {
  it('reports sorted visible player ids and excludes pets', () => {
    const onVisiblePlayerIdsChange = vi.fn()
    const series = [
      createSeries({ actorId: 7, actorType: 'Player', label: 'Rogue' }),
      createSeries({ actorId: 4, actorType: 'Pet', label: 'Wolf', ownerId: 7 }),
      createSeries({ actorId: 3, actorType: 'Player', label: 'Warrior' }),
    ]

    const { result } = renderHook(() =>
      useThreatChartVisiblePlayers({
        clearIsolate: vi.fn(),
        isActorVisible: (actorId) => actorId !== 7,
        onVisiblePlayerIdsChange,
        series,
      }),
    )

    expect(result.current.visiblePlayerIds).toEqual([3])
    expect(result.current.allPlayerIds).toEqual([3, 7])
    expect(result.current.hasHiddenActors).toBe(true)
    expect(onVisiblePlayerIdsChange).toHaveBeenCalledWith([3])
  })

  it('clears isolate state and emits all players when reset is triggered', () => {
    const clearIsolate = vi.fn()
    const onVisiblePlayerIdsChange = vi.fn()
    const series = [
      createSeries({ actorId: 10, actorType: 'Player', label: 'Tank' }),
      createSeries({ actorId: 12, actorType: 'Player', label: 'Mage' }),
    ]

    const { result } = renderHook(() =>
      useThreatChartVisiblePlayers({
        clearIsolate,
        isActorVisible: (actorId) => actorId === 10,
        onVisiblePlayerIdsChange,
        series,
      }),
    )

    act(() => {
      result.current.handleClearIsolate()
    })

    expect(clearIsolate).toHaveBeenCalledTimes(1)
    expect(onVisiblePlayerIdsChange).toHaveBeenLastCalledWith([10, 12])
  })
})
