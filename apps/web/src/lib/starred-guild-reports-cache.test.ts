/**
 * Unit tests for local-storage starred guild report cache helpers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { StarredGuildReportEntry } from '../types/app'
import {
  starredGuildReportsCacheTtlMs,
  starredGuildReportsStorageKey,
} from './constants'
import {
  buildStarredGuildSignature,
  loadStarredGuildReportsCache,
  saveStarredGuildReportsCache,
} from './starred-guild-reports-cache'

const sampleReports: StarredGuildReportEntry[] = [
  {
    reportId: 'ABC123',
    title: 'Guild Log',
    startTime: 1700000000000,
    endTime: 1700000005000,
    zoneName: 'Naxxramas',
    guildId: '777',
    guildName: 'Threat Guild',
    guildFaction: 'Alliance',
    sourceHost: 'fresh.warcraftlogs.com',
  },
]

describe('starred-guild-reports-cache', () => {
  let originalLocalStorage: Storage

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-22T18:00:00.000Z'))

    originalLocalStorage = window.localStorage
    const values = new Map<string, string>()
    const mockLocalStorage = {
      clear: (): void => {
        values.clear()
      },
      getItem: (key: string): string | null => values.get(key) ?? null,
      key: (index: number): string | null =>
        Array.from(values.keys())[index] ?? null,
      get length(): number {
        return values.size
      },
      removeItem: (key: string): void => {
        values.delete(key)
      },
      setItem: (key: string, value: string): void => {
        values.set(key, value)
      },
    } satisfies Storage

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: mockLocalStorage,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    })
  })

  it('loads cache for matching uid, guild signature, and limit within ttl', () => {
    const guildSignature = buildStarredGuildSignature(['777:benediction:US'])
    const fetchedAtMs = Date.now()
    saveStarredGuildReportsCache(
      'wcl:12345',
      guildSignature,
      10,
      sampleReports,
      fetchedAtMs,
    )

    expect(
      loadStarredGuildReportsCache('wcl:12345', guildSignature, 10),
    ).toEqual({
      fetchedAtMs,
      reports: sampleReports,
    })
  })

  it('returns null when cache signature does not match', () => {
    saveStarredGuildReportsCache(
      'wcl:12345',
      buildStarredGuildSignature(['777:benediction:US']),
      10,
      sampleReports,
      Date.now(),
    )

    expect(
      loadStarredGuildReportsCache(
        'wcl:12345',
        buildStarredGuildSignature(['888:faerlina:US']),
        10,
      ),
    ).toBeNull()
  })

  it('returns null when cache is older than ttl', () => {
    const guildSignature = buildStarredGuildSignature(['777:benediction:US'])
    saveStarredGuildReportsCache(
      'wcl:12345',
      guildSignature,
      10,
      sampleReports,
      Date.now(),
    )
    vi.advanceTimersByTime(starredGuildReportsCacheTtlMs + 1)

    expect(loadStarredGuildReportsCache('wcl:12345', guildSignature, 10)).toBe(
      null,
    )
  })

  it('returns null for malformed cache payload', () => {
    window.localStorage.setItem(starredGuildReportsStorageKey, 'not-json')

    expect(loadStarredGuildReportsCache('wcl:12345', '777', 10)).toBeNull()
  })
})
