/**
 * Unit tests for fight events query hook wiring.
 */
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fightEventsQueryKey, fightRawEventsQueryKey } from '../api/reports'
import {
  getFightEventsClientSide,
  getFightRawEventsClientSide,
} from '../lib/client-threat-engine'
import { useFightEvents, useSuspenseFightEvents } from './use-fight-events'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(() => ({
    cancelQueries: vi.fn(),
    ensureQueryData: vi.fn(),
  })),
  useSuspenseQuery: vi.fn(),
}))

vi.mock('../api/reports', () => ({
  fightEventsQueryKey: vi.fn(() => ['fight-events-query-key']),
  fightRawEventsQueryKey: vi.fn(() => ['fight-raw-events-query-key']),
  fightQueryKey: vi.fn(() => ['fight-query-key']),
  getFight: vi.fn(),
  getReport: vi.fn(),
  reportQueryKey: vi.fn(() => ['report-query-key']),
}))

vi.mock('../lib/client-threat-engine', () => ({
  getFightEventsClientSide: vi.fn(),
  getFightRawEventsClientSide: vi.fn(),
}))

describe('useFightEvents', () => {
  const queryClientMock = {
    cancelQueries: vi.fn(),
    ensureQueryData: vi.fn(),
  }

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
        configVersion: 'test',
        events: [],
        fightId: 12,
        fightName: 'Patchwerk',
        gameVersion: 2,
        initialAurasByActor: {},
        reportCode: 'ABC123xyz',
      },
    } as never)
    vi.mocked(getFightEventsClientSide).mockReset()
    vi.mocked(getFightEventsClientSide).mockResolvedValue({
      configVersion: 'test',
      events: [],
      fightId: 12,
      fightName: 'Patchwerk',
      gameVersion: 2,
      initialAurasByActor: {},
      reportCode: 'ABC123xyz',
    })
    vi.mocked(getFightRawEventsClientSide).mockReset()
    vi.mocked(getFightRawEventsClientSide).mockResolvedValue({
      events: [],
      metadata: {
        configVersion: 'test',
        events: [],
        fightId: 12,
        fightName: 'Patchwerk',
        gameVersion: 2,
        initialAurasByActor: {},
        nextPageTimestamp: null,
        reportCode: 'ABC123xyz',
      },
      pageCount: 1,
    })
    vi.mocked(fightEventsQueryKey).mockClear()
    vi.mocked(fightRawEventsQueryKey).mockClear()
    vi.mocked(useQueryClient).mockClear()
    queryClientMock.cancelQueries.mockReset()
    queryClientMock.ensureQueryData.mockReset()
    queryClientMock.ensureQueryData.mockResolvedValue({
      events: [],
      metadata: {
        configVersion: 'test',
        events: [],
        fightId: 12,
        fightName: 'Patchwerk',
        gameVersion: 2,
        initialAurasByActor: {},
        nextPageTimestamp: null,
        reportCode: 'ABC123xyz',
      },
      pageCount: 1,
    })
    vi.mocked(useQueryClient).mockReturnValue(queryClientMock as never)
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

    expect(fightEventsQueryKey).toHaveBeenCalledWith(
      'ABC123xyz',
      12,
      false,
      false,
      false,
    )
    expect(fightEventsQueryKey).toHaveBeenCalledWith(
      'ABC123xyz',
      12,
      true,
      false,
      false,
    )
  })

  it('passes forceFresh through query key generation', () => {
    renderHook(() => useFightEvents('ABC123xyz', 12, true, true, true))

    expect(fightEventsQueryKey).toHaveBeenCalledWith(
      'ABC123xyz',
      12,
      true,
      true,
      false,
    )
  })

  it('passes forceLegacyWorkerMode through query key generation', () => {
    renderHook(() => useFightEvents('ABC123xyz', 12, true, true, false, true))

    expect(fightEventsQueryKey).toHaveBeenCalledWith(
      'ABC123xyz',
      12,
      true,
      false,
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

  it('reuses cached raw events payload when infer toggle changes', async () => {
    renderHook(() => useFightEvents('ABC123xyz', 12, false, true))
    renderHook(() => useFightEvents('ABC123xyz', 12, true, true))

    const firstQueryCall = vi.mocked(useQuery).mock.calls[0]?.[0]
    const secondQueryCall = vi.mocked(useQuery).mock.calls[1]?.[0]
    expect(firstQueryCall).toBeDefined()
    expect(secondQueryCall).toBeDefined()

    await firstQueryCall?.queryFn({
      signal: new AbortController().signal,
    })
    await secondQueryCall?.queryFn({
      signal: new AbortController().signal,
    })

    expect(fightRawEventsQueryKey).toHaveBeenCalledTimes(2)
    expect(fightRawEventsQueryKey).toHaveBeenNthCalledWith(1, 'ABC123xyz', 12)
    expect(fightRawEventsQueryKey).toHaveBeenNthCalledWith(2, 'ABC123xyz', 12)

    expect(queryClientMock.ensureQueryData).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['fight-raw-events-query-key'],
      }),
    )

    expect(getFightEventsClientSide).toHaveBeenCalledTimes(2)
    expect(getFightEventsClientSide).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        inferThreatReduction: false,
        rawEventsData: expect.objectContaining({
          pageCount: 1,
        }),
      }),
    )
    expect(getFightEventsClientSide).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        inferThreatReduction: true,
        rawEventsData: expect.objectContaining({
          pageCount: 1,
        }),
      }),
    )
  })

  it('bypasses react-query raw events cache when forceFresh is enabled', async () => {
    renderHook(() => useFightEvents('ABC123xyz', 12, false, true, true))

    const queryCall = vi.mocked(useQuery).mock.calls[0]?.[0]
    expect(queryCall).toBeDefined()

    await queryCall?.queryFn({
      signal: new AbortController().signal,
    })

    expect(fightRawEventsQueryKey).not.toHaveBeenCalled()
    expect(getFightRawEventsClientSide).toHaveBeenCalledTimes(1)
    expect(getFightEventsClientSide).toHaveBeenCalledWith(
      expect.objectContaining({
        forceLegacyWorkerMode: false,
        inferThreatReduction: false,
        rawEventsData: expect.objectContaining({
          pageCount: 1,
        }),
      }),
    )
  })

  it('passes forceLegacyWorkerMode to client processing', async () => {
    renderHook(() => useFightEvents('ABC123xyz', 12, false, true, false, true))

    const queryCall = vi.mocked(useQuery).mock.calls[0]?.[0]
    expect(queryCall).toBeDefined()

    await queryCall?.queryFn({
      signal: new AbortController().signal,
    })

    expect(getFightEventsClientSide).toHaveBeenCalledWith(
      expect.objectContaining({
        forceLegacyWorkerMode: true,
        inferThreatReduction: false,
      }),
    )
  })
})
