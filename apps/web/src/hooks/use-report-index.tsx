/* eslint-disable react-refresh/only-export-components */
/**
 * Shared report-search index provider for command input and homepage lists.
 */
import { useAuth } from '@/auth/auth-provider'
import { type FC, type PropsWithChildren } from 'react'
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  defaultHost,
  reportSearchIndexRefreshIntervalMs,
} from '../lib/constants'
import {
  type ReportSearchSuggestion,
  buildReportSearchDocuments,
  createReportSearchIndex,
  searchReportDocuments,
} from '../lib/report-search'
import {
  type ReportSearchDocument,
  loadReportSearchIndexSnapshot,
  saveReportSearchIndexSnapshot,
} from '../lib/report-search-index-cache'
import type { RecentReportSummary } from '../types/api'
import type {
  RecentReportEntry,
  StarredGuildReportEntry,
  WarcraftLogsHost,
} from '../types/app'
import { useStarredGuildReports } from './use-starred-guild-reports'
import { useUserRecentReports } from './use-user-recent-reports'
import { useUserSettings } from './use-user-settings'

const maxLocalRecentReports = 10

function upsertLocalRecentReport(
  current: RecentReportEntry[],
  next: RecentReportEntry,
): RecentReportEntry[] {
  return [
    next,
    ...current.filter((entry) => entry.reportId !== next.reportId),
  ].slice(0, maxLocalRecentReports)
}

function removeLocalRecentReport(
  current: RecentReportEntry[],
  reportId: string,
): RecentReportEntry[] {
  return current.filter((entry) => entry.reportId !== reportId)
}

function sortGuildReportsByStartTime(
  reports: StarredGuildReportEntry[],
): StarredGuildReportEntry[] {
  return [...reports].sort((left, right) => right.startTime - left.startTime)
}

function sortPersonalReportsByStartTime(
  reports: RecentReportSummary[],
): RecentReportSummary[] {
  return [...reports].sort((left, right) => right.startTime - left.startTime)
}

export interface UseReportIndexResult {
  documents: ReportSearchDocument[]
  recentReports: RecentReportEntry[]
  personalReports: RecentReportSummary[]
  guildReports: StarredGuildReportEntry[]
  lastRefreshAtMs: number | null
  isLoadingPersonalReports: boolean
  isRefreshingPersonalReports: boolean
  personalReportsError: Error | null
  isLoadingGuildReports: boolean
  isRefreshingGuildReports: boolean
  guildReportsError: Error | null
  searchReports: (query: string, limit?: number) => ReportSearchSuggestion[]
  resolveReportHost: (reportId: string) => WarcraftLogsHost
  addRecentReport: (entry: RecentReportEntry) => void
  removeRecentReport: (reportId: string) => void
  refreshPersonalReports: () => Promise<void>
  refreshGuildReports: () => Promise<void>
}

const ReportIndexContext = createContext<UseReportIndexResult | null>(null)

/** Provides shared report-index state and search helpers to the app tree. */
export const ReportIndexProvider: FC<PropsWithChildren> = ({ children }) => {
  const { authEnabled, isBusy, user, wclUserId } = useAuth()
  const { settings } = useUserSettings()
  const uid = user?.uid ?? null

  const persistedSnapshot = useMemo(
    () => loadReportSearchIndexSnapshot(uid),
    [uid],
  )
  const [recentReportsState, setRecentReportsState] = useState<{
    uid: string | null
    reports: RecentReportEntry[]
  }>(() => ({
    uid,
    reports: persistedSnapshot?.recentReports ?? [],
  }))
  const recentReports = useMemo(
    () =>
      recentReportsState.uid === uid
        ? recentReportsState.reports
        : (persistedSnapshot?.recentReports ?? []),
    [persistedSnapshot?.recentReports, recentReportsState, uid],
  )

  const shouldFetchPersonalReports =
    !isBusy && authEnabled && Boolean(uid) && Boolean(wclUserId)
  const shouldFetchGuildReports = !isBusy

  const personalReportsQuery = useUserRecentReports(20, {
    enabled: shouldFetchPersonalReports,
    staleTimeMs: reportSearchIndexRefreshIntervalMs,
  })
  const guildReportsQuery = useStarredGuildReports(20, {
    enabled: shouldFetchGuildReports,
    staleTimeMs: reportSearchIndexRefreshIntervalMs,
  })

  const personalReports = useMemo(
    () =>
      sortPersonalReportsByStartTime(
        personalReportsQuery.hasFetchedSuccessfully
          ? personalReportsQuery.reports
          : (persistedSnapshot?.personalReports ?? []),
      ),
    [
      personalReportsQuery.hasFetchedSuccessfully,
      personalReportsQuery.reports,
      persistedSnapshot?.personalReports,
    ],
  )
  const guildReports = useMemo(
    () =>
      sortGuildReportsByStartTime(
        guildReportsQuery.hasFetchedSuccessfully
          ? guildReportsQuery.reports
          : (persistedSnapshot?.guildReports ?? []),
      ),
    [
      guildReportsQuery.hasFetchedSuccessfully,
      guildReportsQuery.reports,
      persistedSnapshot?.guildReports,
    ],
  )

  const includeExamples = recentReports.length === 0
  const documents = useMemo(
    () =>
      buildReportSearchDocuments({
        starredReports: settings.starredReports,
        recentReports,
        personalReports,
        guildReports,
        includeExamples,
      }),
    [
      guildReports,
      includeExamples,
      personalReports,
      recentReports,
      settings.starredReports,
    ],
  )

  const lastRefreshAtMs = useMemo(() => {
    const latestRefreshAt = Math.max(
      persistedSnapshot?.lastRefreshAtMs ?? 0,
      personalReportsQuery.dataUpdatedAt,
      guildReportsQuery.dataUpdatedAt,
    )
    return latestRefreshAt > 0 ? latestRefreshAt : null
  }, [
    guildReportsQuery.dataUpdatedAt,
    persistedSnapshot?.lastRefreshAtMs,
    personalReportsQuery.dataUpdatedAt,
  ])
  const searchIndex = useMemo(
    () => createReportSearchIndex(documents),
    [documents],
  )

  useEffect(() => {
    saveReportSearchIndexSnapshot({
      uid,
      savedAtMs: Date.now(),
      lastRefreshAtMs,
      documents,
      recentReports,
      personalReports,
      guildReports,
    })
  }, [
    documents,
    guildReports,
    lastRefreshAtMs,
    personalReports,
    recentReports,
    uid,
  ])

  const value: UseReportIndexResult = {
    documents,
    recentReports,
    personalReports,
    guildReports,
    lastRefreshAtMs,
    isLoadingPersonalReports: personalReportsQuery.isLoading,
    isRefreshingPersonalReports: personalReportsQuery.isRefreshing,
    personalReportsError: personalReportsQuery.error,
    isLoadingGuildReports: guildReportsQuery.isLoading,
    isRefreshingGuildReports: guildReportsQuery.isRefreshing,
    guildReportsError: guildReportsQuery.error,
    searchReports: (query: string, limit = 20) =>
      searchReportDocuments(searchIndex, documents, query, limit),
    resolveReportHost: (reportId: string) =>
      documents.find((entry) => entry.reportId === reportId)?.sourceHost ??
      defaultHost,
    addRecentReport: (entry: RecentReportEntry) => {
      setRecentReportsState((current) => ({
        uid,
        reports: upsertLocalRecentReport(
          current.uid === uid
            ? current.reports
            : (persistedSnapshot?.recentReports ?? []),
          entry,
        ),
      }))
    },
    removeRecentReport: (reportId: string) => {
      setRecentReportsState((current) => ({
        uid,
        reports: removeLocalRecentReport(
          current.uid === uid
            ? current.reports
            : (persistedSnapshot?.recentReports ?? []),
          reportId,
        ),
      }))
    },
    refreshPersonalReports: async () => {
      await personalReportsQuery.refresh()
    },
    refreshGuildReports: async () => {
      await guildReportsQuery.refresh()
    },
  }

  return createElement(ReportIndexContext.Provider, { value }, children)
}

/** Reads the shared report-index state from context. */
export function useReportIndex(): UseReportIndexResult {
  const context = useContext(ReportIndexContext)
  if (!context) {
    throw new Error('useReportIndex must be used within ReportIndexProvider')
  }

  return context
}
