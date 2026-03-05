/**
 * Unit tests for client-side fight event pagination behavior.
 */
import { createDamageEvent } from '@wow-threat/shared'
import type { WCLEvent } from '@wow-threat/wcl-types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getFightEventsPage } from '../api/reports'
import type { FightEventsResponse } from '../types/api'
import { getFightRawEventsClientSide } from './client-threat-engine'

vi.mock('../api/reports', () => ({
  getFightEventsPage: vi.fn(),
}))

function createEventsPage(params: {
  events: WCLEvent[]
  nextPageTimestamp: number | null
}): FightEventsResponse {
  const { events, nextPageTimestamp } = params
  return {
    reportCode: 'ABC123xyz',
    fightId: 12,
    fightName: 'Patchwerk',
    gameVersion: 2,
    configVersion: 'test-config',
    events,
    nextPageTimestamp,
    initialAurasByActor: undefined,
  }
}

describe('getFightRawEventsClientSide', () => {
  beforeEach(() => {
    vi.mocked(getFightEventsPage).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches pages sequentially with cursor chaining and preserves event order', async () => {
    const firstEvent = createDamageEvent({ timestamp: 1000 })
    const secondEvent = createDamageEvent({ timestamp: 2000 })
    const thirdEvent = createDamageEvent({ timestamp: 3000 })

    vi.mocked(getFightEventsPage)
      .mockResolvedValueOnce(
        createEventsPage({
          events: [firstEvent],
          nextPageTimestamp: 2000,
        }),
      )
      .mockResolvedValueOnce(
        createEventsPage({
          events: [secondEvent],
          nextPageTimestamp: 3000,
        }),
      )
      .mockResolvedValueOnce(
        createEventsPage({
          events: [thirdEvent],
          nextPageTimestamp: null,
        }),
      )

    const result = await getFightRawEventsClientSide({
      reportId: 'ABC123xyz',
      fightId: 12,
    })

    expect(getFightEventsPage).toHaveBeenNthCalledWith(
      1,
      'ABC123xyz',
      12,
      undefined,
      undefined,
    )
    expect(getFightEventsPage).toHaveBeenNthCalledWith(
      2,
      'ABC123xyz',
      12,
      2000,
      undefined,
    )
    expect(getFightEventsPage).toHaveBeenNthCalledWith(
      3,
      'ABC123xyz',
      12,
      3000,
      undefined,
    )
    expect(result.pageCount).toBe(3)
    expect(result.events).toEqual([firstEvent, secondEvent, thirdEvent])
  })

  it('yields to the event loop after each fetched page', async () => {
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((callback) => {
        if (typeof callback === 'function') {
          callback()
        }
        return 0 as ReturnType<typeof globalThis.setTimeout>
      })

    vi.mocked(getFightEventsPage)
      .mockResolvedValueOnce(
        createEventsPage({
          events: [createDamageEvent({ timestamp: 1000 })],
          nextPageTimestamp: 2000,
        }),
      )
      .mockResolvedValueOnce(
        createEventsPage({
          events: [createDamageEvent({ timestamp: 2000 })],
          nextPageTimestamp: null,
        }),
      )

    const result = await getFightRawEventsClientSide({
      reportId: 'ABC123xyz',
      fightId: 12,
    })

    const zeroDelayTimeouts = setTimeoutSpy.mock.calls.filter(
      ([, delay]) => delay === 0,
    )
    expect(result.pageCount).toBe(2)
    expect(zeroDelayTimeouts).toHaveLength(2)
  })

  it('stops paging and rejects when request context becomes stale', async () => {
    let requestIsCurrent = true

    vi.mocked(getFightEventsPage).mockResolvedValue(
      createEventsPage({
        events: [createDamageEvent({ timestamp: 1000 })],
        nextPageTimestamp: 2000,
      }),
    )

    await expect(
      getFightRawEventsClientSide({
        reportId: 'ABC123xyz',
        fightId: 12,
        isRequestCurrent: () => requestIsCurrent,
        onProgress: (progress) => {
          if (progress.pagesLoaded === 1) {
            requestIsCurrent = false
          }
        },
      }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    })

    expect(getFightEventsPage).toHaveBeenCalledTimes(1)
  })

  it('fails fast when a page fetch errors and does not retry automatically', async () => {
    vi.mocked(getFightEventsPage).mockRejectedValueOnce(
      new Error('network failed'),
    )

    await expect(
      getFightRawEventsClientSide({
        reportId: 'ABC123xyz',
        fightId: 12,
      }),
    ).rejects.toThrow('network failed')

    expect(getFightEventsPage).toHaveBeenCalledTimes(1)
  })
})
