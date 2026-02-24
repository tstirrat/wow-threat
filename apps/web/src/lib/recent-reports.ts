/**
 * Local storage utilities for recently viewed reports.
 */
import type { RecentReportEntry } from '../types/app'
import { recentReportsStorageKey } from './constants'

const maxRecentReports = 10

/** Read recent report entries from local storage. */
export function loadRecentReports(): RecentReportEntry[] {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = window.localStorage.getItem(recentReportsStorageKey)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as RecentReportEntry[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.slice(0, maxRecentReports)
  } catch {
    return []
  }
}

/** Persist recent reports back into local storage. */
export function saveRecentReports(entries: RecentReportEntry[]): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    recentReportsStorageKey,
    JSON.stringify(entries.slice(0, maxRecentReports)),
  )
}

/** Upsert a report entry while preserving recency ordering and max length. */
export function upsertRecentReport(
  entry: RecentReportEntry,
): RecentReportEntry[] {
  const deduped = loadRecentReports().filter(
    (item) => item.reportId !== entry.reportId,
  )
  const next = [entry, ...deduped].slice(0, maxRecentReports)
  saveRecentReports(next)
  return next
}

/** Remove a recent report entry by report ID. */
export function removeRecentReport(reportId: string): RecentReportEntry[] {
  const next = loadRecentReports().filter((item) => item.reportId !== reportId)
  saveRecentReports(next)
  return next
}
