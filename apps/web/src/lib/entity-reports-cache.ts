/**
 * Local-storage cache helpers for entity report listings.
 */
import type { EntityReportsResponse } from '../types/api'
import {
  entityReportsStorageKey,
  starredGuildReportsCacheTtlMs,
} from './constants'

interface CachedEntityReportsEntry {
  entityKey: string
  fetchedAtMs: number
  response: EntityReportsResponse
  uid: string
}

interface CachedEntityReportsStore {
  entries: CachedEntityReportsEntry[]
}

export interface EntityReportsCacheEntry {
  fetchedAtMs: number
  response: EntityReportsResponse
}

function parseCacheStore(raw: string): CachedEntityReportsStore | null {
  try {
    const parsed = JSON.parse(raw) as CachedEntityReportsStore
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.entries)
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function loadStore(): CachedEntityReportsStore {
  if (typeof window === 'undefined') {
    return {
      entries: [],
    }
  }

  const raw = window.localStorage.getItem(entityReportsStorageKey)
  if (!raw) {
    return {
      entries: [],
    }
  }

  return parseCacheStore(raw) ?? { entries: [] }
}

function saveStore(store: CachedEntityReportsStore): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(entityReportsStorageKey, JSON.stringify(store))
}

/** Build a stable cache key for an entity reports request. */
export function buildEntityReportsCacheKey(options: {
  entityType: 'guild'
  guildId?: number
  guildName?: string
  serverSlug?: string
  serverRegion?: string
  limit: number
}): string {
  return [
    options.entityType,
    options.guildId ?? '',
    options.guildName ?? '',
    options.serverSlug ?? '',
    options.serverRegion ?? '',
    options.limit,
  ].join('|')
}

/** Load cached entity reports for a specific uid + entity lookup key. */
export function loadEntityReportsCache(
  uid: string,
  entityKey: string,
): EntityReportsCacheEntry | null {
  const store = loadStore()
  const now = Date.now()

  const matchingEntry = store.entries.find(
    (entry) => entry.uid === uid && entry.entityKey === entityKey,
  )
  if (!matchingEntry) {
    return null
  }

  const ageMs = now - matchingEntry.fetchedAtMs
  if (ageMs > starredGuildReportsCacheTtlMs) {
    return null
  }

  return {
    fetchedAtMs: matchingEntry.fetchedAtMs,
    response: matchingEntry.response,
  }
}

/** Save entity reports cache for a specific uid + entity lookup key. */
export function saveEntityReportsCache(
  uid: string,
  entityKey: string,
  response: EntityReportsResponse,
  fetchedAtMs: number,
): void {
  const store = loadStore()
  const nextEntries = [
    {
      uid,
      entityKey,
      response,
      fetchedAtMs,
    },
    ...store.entries.filter(
      (entry) => !(entry.uid === uid && entry.entityKey === entityKey),
    ),
  ].slice(0, 50)

  saveStore({
    entries: nextEntries,
  })
}
