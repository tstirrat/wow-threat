/**
 * Unit tests for local-storage entity report cache helpers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EntityReportsResponse } from '../types/api'
import {
  entityReportsStorageKey,
  starredGuildReportsCacheTtlMs,
} from './constants'
import {
  buildEntityReportsCacheKey,
  loadEntityReportsCache,
  saveEntityReportsCache,
} from './entity-reports-cache'

const sampleResponse: EntityReportsResponse = {
  entityType: 'guild',
  entity: {
    id: 777,
    name: 'Threat Guild',
    faction: 'Alliance',
    serverSlug: 'benediction',
    serverRegion: 'US',
  },
  reports: [
    {
      code: 'ABC123',
      title: 'Guild Log',
      startTime: 1700000000000,
      endTime: 1700000005000,
      zoneName: 'Naxxramas',
      guildName: 'Threat Guild',
      guildFaction: 'Alliance',
    },
  ],
}

describe('entity-reports-cache', () => {
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

  it('loads cache for matching uid and entity key within ttl', () => {
    const entityKey = buildEntityReportsCacheKey({
      entityType: 'guild',
      guildId: 777,
      guildName: 'Threat Guild',
      serverSlug: 'benediction',
      serverRegion: 'US',
      limit: 20,
    })
    const fetchedAtMs = Date.now()
    saveEntityReportsCache('wcl:12345', entityKey, sampleResponse, fetchedAtMs)

    expect(loadEntityReportsCache('wcl:12345', entityKey)).toEqual({
      fetchedAtMs,
      response: sampleResponse,
    })
  })

  it('returns null for malformed cache payload', () => {
    window.localStorage.setItem(entityReportsStorageKey, 'not-json')
    expect(loadEntityReportsCache('wcl:12345', 'guild|777')).toBeNull()
  })

  it('returns null when cache is older than ttl', () => {
    const entityKey = buildEntityReportsCacheKey({
      entityType: 'guild',
      guildId: 777,
      guildName: 'Threat Guild',
      serverSlug: 'benediction',
      serverRegion: 'US',
      limit: 20,
    })
    saveEntityReportsCache('wcl:12345', entityKey, sampleResponse, Date.now())
    vi.advanceTimersByTime(starredGuildReportsCacheTtlMs + 1)

    expect(loadEntityReportsCache('wcl:12345', entityKey)).toBeNull()
  })
})
