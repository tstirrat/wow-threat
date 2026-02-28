/**
 * Local-storage cache helpers for the shared report-search index snapshot.
 */
import type { RecentReportSummary } from '../types/api'
import type {
  RecentReportEntry,
  StarredGuildReportEntry,
  WarcraftLogsHost,
} from '../types/app'
import {
  reportSearchIndexRefreshIntervalMs,
  reportSearchIndexRetentionMs,
  reportSearchIndexStorageKey,
} from './constants'

export type ReportSearchSourceTag =
  | 'example'
  | 'guild'
  | 'personal'
  | 'recent'
  | 'starred'

export interface ReportSearchDocument {
  reportId: string
  title: string
  sourceHost: WarcraftLogsHost
  guildName: string | null
  guildFaction: string | null
  zoneName: string | null
  startTime: number | null
  endTime: number | null
  bossKillCount: number | null
  lastOpenedAt: number | null
  starredAt: number | null
  sourceTags: ReportSearchSourceTag[]
  aliases: string[]
}

interface PersistedReportSearchIndex {
  version: 1
  uid: string | null
  savedAtMs: number
  lastRefreshAtMs: number | null
  documents: ReportSearchDocument[]
  recentReports: RecentReportEntry[]
  personalReports: RecentReportSummary[]
  guildReports: StarredGuildReportEntry[]
}

export interface ReportSearchIndexSnapshot {
  uid: string | null
  savedAtMs: number
  lastRefreshAtMs: number | null
  documents: ReportSearchDocument[]
  recentReports: RecentReportEntry[]
  personalReports: RecentReportSummary[]
  guildReports: StarredGuildReportEntry[]
}

function parseSnapshot(raw: string): PersistedReportSearchIndex | null {
  try {
    const parsed = JSON.parse(raw) as PersistedReportSearchIndex
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.version !== 1 ||
      (parsed.uid !== null && typeof parsed.uid !== 'string') ||
      typeof parsed.savedAtMs !== 'number' ||
      (parsed.lastRefreshAtMs !== null &&
        typeof parsed.lastRefreshAtMs !== 'number') ||
      !Array.isArray(parsed.documents) ||
      !Array.isArray(parsed.recentReports) ||
      !Array.isArray(parsed.personalReports) ||
      !Array.isArray(parsed.guildReports)
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

/** Load cached report-search snapshot for the active uid. */
export function loadReportSearchIndexSnapshot(
  uid: string | null,
): ReportSearchIndexSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(reportSearchIndexStorageKey)
  if (!raw) {
    return null
  }

  const parsed = parseSnapshot(raw)
  if (!parsed || parsed.uid !== uid) {
    return null
  }

  if (Date.now() - parsed.savedAtMs > reportSearchIndexRetentionMs) {
    return null
  }

  return {
    uid: parsed.uid,
    savedAtMs: parsed.savedAtMs,
    lastRefreshAtMs: parsed.lastRefreshAtMs,
    documents: parsed.documents,
    recentReports: parsed.recentReports,
    personalReports: parsed.personalReports,
    guildReports: parsed.guildReports,
  }
}

/** Save the current report-search snapshot to local storage. */
export function saveReportSearchIndexSnapshot(
  snapshot: ReportSearchIndexSnapshot,
): void {
  if (typeof window === 'undefined') {
    return
  }

  const persisted: PersistedReportSearchIndex = {
    version: 1,
    uid: snapshot.uid,
    savedAtMs: snapshot.savedAtMs,
    lastRefreshAtMs: snapshot.lastRefreshAtMs,
    documents: snapshot.documents,
    recentReports: snapshot.recentReports,
    personalReports: snapshot.personalReports,
    guildReports: snapshot.guildReports,
  }
  window.localStorage.setItem(
    reportSearchIndexStorageKey,
    JSON.stringify(persisted),
  )
}

/** Returns true when remote data should refresh in the background. */
export function shouldRefreshReportSearchIndex(
  lastRefreshAtMs: number | null,
): boolean {
  if (lastRefreshAtMs === null) {
    return true
  }

  return Date.now() - lastRefreshAtMs >= reportSearchIndexRefreshIntervalMs
}
