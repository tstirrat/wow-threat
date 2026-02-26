/**
 * Local-storage cache helpers for starred guild report feed.
 */
import type { StarredGuildReportEntry } from '../types/app'
import {
  starredGuildReportsCacheTtlMs,
  starredGuildReportsStorageKey,
} from './constants'

interface CachedStarredGuildReports {
  fetchedAtMs: number
  guildSignature: string
  limit: number
  reports: StarredGuildReportEntry[]
  uid: string
}

export interface StarredGuildReportsCacheEntry {
  fetchedAtMs: number
  reports: StarredGuildReportEntry[]
}

function parseCacheEntry(raw: string): CachedStarredGuildReports | null {
  try {
    const parsed = JSON.parse(raw) as CachedStarredGuildReports
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.uid !== 'string' ||
      typeof parsed.guildSignature !== 'string' ||
      typeof parsed.limit !== 'number' ||
      !Array.isArray(parsed.reports) ||
      typeof parsed.fetchedAtMs !== 'number'
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

/** Build a deterministic signature for a set of starred guilds. */
export function buildStarredGuildSignature(guildKeys: string[]): string {
  return [...new Set(guildKeys)].sort().join('|')
}

/** Load cached starred guild reports for a specific uid + guild signature. */
export function loadStarredGuildReportsCache(
  uid: string,
  guildSignature: string,
  limit: number,
): StarredGuildReportsCacheEntry | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(starredGuildReportsStorageKey)
  if (!raw) {
    return null
  }

  const parsed = parseCacheEntry(raw)
  if (
    !parsed ||
    parsed.uid !== uid ||
    parsed.guildSignature !== guildSignature ||
    parsed.limit !== limit
  ) {
    return null
  }

  const ageMs = Date.now() - parsed.fetchedAtMs
  if (ageMs > starredGuildReportsCacheTtlMs) {
    return null
  }

  return {
    fetchedAtMs: parsed.fetchedAtMs,
    reports: parsed.reports,
  }
}

/** Save starred guild reports for a specific uid + guild signature. */
export function saveStarredGuildReportsCache(
  uid: string,
  guildSignature: string,
  limit: number,
  reports: StarredGuildReportEntry[],
  fetchedAtMs: number,
): void {
  if (typeof window === 'undefined') {
    return
  }

  const entry: CachedStarredGuildReports = {
    uid,
    guildSignature,
    limit,
    reports,
    fetchedAtMs,
  }
  window.localStorage.setItem(
    starredGuildReportsStorageKey,
    JSON.stringify(entry),
  )
}
