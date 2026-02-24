/**
 * Unit tests for fight events query hook wiring.
 */
import { renderHook } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fightEventsQueryKey, getFightEvents } from '../api/reports'
import { useFightEvents } from './use-fight-events'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
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
    vi.mocked(fightEventsQueryKey).mockClear()
    vi.mocked(getFightEvents).mockClear()
  })

  it('keeps query disabled when enabled flag is false', () => {
    renderHook(() => useFightEvents('ABC123xyz', 12, '1.3.1', true, false))

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    )
  })

  it('enables query when enabled flag is true and inputs are valid', () => {
    renderHook(() => useFightEvents('ABC123xyz', 12, '1.3.1', true, true))

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
    )
  })

  it('passes inferThreatReduction through query key generation', () => {
    renderHook(() => useFightEvents('ABC123xyz', 12, '1.3.1', false, true))
    renderHook(() => useFightEvents('ABC123xyz', 12, '1.3.1', true, true))

    expect(fightEventsQueryKey).toHaveBeenNthCalledWith(
      1,
      'ABC123xyz',
      12,
      '1.3.1',
      false,
    )
    expect(fightEventsQueryKey).toHaveBeenNthCalledWith(
      2,
      'ABC123xyz',
      12,
      '1.3.1',
      true,
    )
  })
})
