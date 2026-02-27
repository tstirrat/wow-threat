/**
 * Unit tests for fight events query hook wiring.
 */
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fightEventsQueryKey, getFightEvents } from '../api/reports'
import { useFightEvents, useSuspenseFightEvents } from './use-fight-events'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useSuspenseQuery: vi.fn(),
}))

vi.mock('../api/reports', () => ({
  fightEventsQueryKey: vi.fn(() => ['fight-events-query-key']),
  getFightEvents: vi.fn(),
}))

describe('useFightEvents', () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset()
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    } as never)
    vi.mocked(useSuspenseQuery).mockReset()
    vi.mocked(useSuspenseQuery).mockReturnValue({
      data: {
        events: [],
        initialAurasByActor: {},
        summary: {
          duration: 0,
          eventCount: 0,
          generatedAt: '',
          fightId: 12,
          reportCode: 'ABC123xyz',
        },
      },
    } as never)
    vi.mocked(fightEventsQueryKey).mockClear()
    vi.mocked(getFightEvents).mockClear()
  })

  it('keeps query disabled when enabled flag is false', () => {
    renderHook(() => useFightEvents('ABC123xyz', 12, true, false))

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    )
  })

  it('enables query when enabled flag is true and inputs are valid', () => {
    renderHook(() => useFightEvents('ABC123xyz', 12, true, true))

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
    )
  })

  it('passes inferThreatReduction through query key generation', () => {
    renderHook(() => useFightEvents('ABC123xyz', 12, false, true))
    renderHook(() => useFightEvents('ABC123xyz', 12, true, true))

    expect(fightEventsQueryKey).toHaveBeenNthCalledWith(
      1,
      'ABC123xyz',
      12,
      false,
    )
    expect(fightEventsQueryKey).toHaveBeenNthCalledWith(
      2,
      'ABC123xyz',
      12,
      true,
    )
  })

  it('uses suspense query wiring for suspense consumers', () => {
    renderHook(() => useSuspenseFightEvents('ABC123xyz', 12, true))

    expect(useSuspenseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['fight-events-query-key'],
      }),
    )
  })
})
