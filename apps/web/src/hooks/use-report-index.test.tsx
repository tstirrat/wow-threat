/**
 * Unit tests for report index snapshot fallback behavior.
 */
import type { AuthContextValue } from '@/auth/auth-provider'
import { render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RecentReportSummary } from '../types/api'
import type { StarredGuildReportEntry } from '../types/app'
import { ReportIndexProvider, useReportIndex } from './use-report-index'
import type { UseStarredGuildReportsResult } from './use-starred-guild-reports'
import type { UseUserRecentReportsResult } from './use-user-recent-reports'

const useAuthMock = vi.fn()
const useUserSettingsMock = vi.fn()
const useUserRecentReportsMock = vi.fn()
const useStarredGuildReportsMock = vi.fn()
const loadReportSearchIndexSnapshotMock = vi.fn()
const saveReportSearchIndexSnapshotMock = vi.fn()

vi.mock('@/auth/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('./use-user-settings', () => ({
  useUserSettings: () => useUserSettingsMock(),
}))

vi.mock('./use-user-recent-reports', () => ({
  useUserRecentReports: (...args: unknown[]) =>
    useUserRecentReportsMock(...args),
}))

vi.mock('./use-starred-guild-reports', () => ({
  useStarredGuildReports: (...args: unknown[]) =>
    useStarredGuildReportsMock(...args),
}))

vi.mock('../lib/report-search-index-cache', () => ({
  loadReportSearchIndexSnapshot: (...args: unknown[]) =>
    loadReportSearchIndexSnapshotMock(...args),
  saveReportSearchIndexSnapshot: (...args: unknown[]) =>
    saveReportSearchIndexSnapshotMock(...args),
}))

function createAuthValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    authEnabled: true,
    authError: null,
    completeBridgeSignIn: vi.fn(),
    isBusy: false,
    isInitializing: false,
    signOut: vi.fn(),
    startWclLogin: vi.fn(),
    user: {
      uid: 'uid-123',
    } as User,
    wclUserId: '123',
    wclUserName: 'tester',
    ...overrides,
  }
}

function createPersonalReport(
  code: string,
  startTime: number,
): RecentReportSummary {
  return {
    code,
    title: code,
    startTime,
    endTime: startTime + 1,
    zoneName: 'Naxxramas',
    guildName: '<SQUAWK>',
    guildFaction: 'Alliance',
    source: 'personal',
  }
}

function createGuildReport(
  reportId: string,
  startTime: number,
): StarredGuildReportEntry {
  return {
    reportId,
    title: reportId,
    startTime,
    endTime: startTime + 1,
    zoneName: 'Karazhan',
    guildId: '77',
    guildName: '<SQUAWK>',
    guildFaction: 'Alliance',
    sourceHost: 'fresh.warcraftlogs.com',
  }
}

function createRecentReportsQueryResult(
  overrides: Partial<UseUserRecentReportsResult> = {},
): UseUserRecentReportsResult {
  return {
    reports: [],
    isLoading: false,
    isRefreshing: false,
    hasFetched: true,
    hasFetchedSuccessfully: true,
    dataUpdatedAt: 0,
    error: null,
    refresh: async () => undefined,
    ...overrides,
  }
}

function createGuildReportsQueryResult(
  overrides: Partial<UseStarredGuildReportsResult> = {},
): UseStarredGuildReportsResult {
  return {
    reports: [],
    trackedGuildCount: 0,
    isLoading: false,
    isRefreshing: false,
    hasFetched: true,
    hasFetchedSuccessfully: true,
    dataUpdatedAt: 0,
    error: null,
    refresh: async () => undefined,
    ...overrides,
  }
}

function Harness(): JSX.Element {
  const { personalReports, guildReports } = useReportIndex()

  return (
    <div>
      <p data-testid="personal-report-codes">
        {personalReports.map((report) => report.code).join(',')}
      </p>
      <p data-testid="guild-report-codes">
        {guildReports.map((report) => report.reportId).join(',')}
      </p>
    </div>
  )
}

describe('ReportIndexProvider', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    useUserSettingsMock.mockReset()
    useUserRecentReportsMock.mockReset()
    useStarredGuildReportsMock.mockReset()
    loadReportSearchIndexSnapshotMock.mockReset()
    saveReportSearchIndexSnapshotMock.mockReset()

    useAuthMock.mockReturnValue(createAuthValue())
    useUserSettingsMock.mockReturnValue({
      settings: {
        inferThreatReduction: false,
        showBossMelee: true,
        showEnergizeEvents: false,
        showPets: false,
        starredReports: [],
        starredEntities: [],
      },
    })
  })

  it('keeps stale persisted lists when remote queries have fetched but failed', () => {
    const persistedPersonalReports = [
      createPersonalReport('persisted-personal', 1),
    ]
    const persistedGuildReports = [createGuildReport('persisted-guild', 1)]

    loadReportSearchIndexSnapshotMock.mockReturnValue({
      uid: 'uid-123',
      savedAtMs: 100,
      lastRefreshAtMs: 100,
      documents: [],
      recentReports: [],
      personalReports: persistedPersonalReports,
      guildReports: persistedGuildReports,
    })
    useUserRecentReportsMock.mockReturnValue(
      createRecentReportsQueryResult({
        reports: [],
        hasFetched: true,
        hasFetchedSuccessfully: false,
        error: new Error('Unauthorized'),
      }),
    )
    useStarredGuildReportsMock.mockReturnValue(
      createGuildReportsQueryResult({
        reports: [],
        hasFetched: true,
        hasFetchedSuccessfully: false,
        error: new Error('Unauthorized'),
      }),
    )

    render(
      <ReportIndexProvider>
        <Harness />
      </ReportIndexProvider>,
    )

    expect(screen.getByTestId('personal-report-codes')).toHaveTextContent(
      'persisted-personal',
    )
    expect(screen.getByTestId('guild-report-codes')).toHaveTextContent(
      'persisted-guild',
    )
  })

  it('switches to remote lists after successful fetch completes', () => {
    const persistedPersonalReports = [
      createPersonalReport('persisted-personal', 1),
    ]
    const persistedGuildReports = [createGuildReport('persisted-guild', 1)]
    loadReportSearchIndexSnapshotMock.mockReturnValue({
      uid: 'uid-123',
      savedAtMs: 100,
      lastRefreshAtMs: 100,
      documents: [],
      recentReports: [],
      personalReports: persistedPersonalReports,
      guildReports: persistedGuildReports,
    })

    let personalReportsQueryResult = createRecentReportsQueryResult({
      reports: [],
      hasFetched: true,
      hasFetchedSuccessfully: false,
      error: new Error('Unauthorized'),
    })
    let guildReportsQueryResult = createGuildReportsQueryResult({
      reports: [],
      hasFetched: true,
      hasFetchedSuccessfully: false,
      error: new Error('Unauthorized'),
    })

    useUserRecentReportsMock.mockImplementation(
      () => personalReportsQueryResult,
    )
    useStarredGuildReportsMock.mockImplementation(() => guildReportsQueryResult)

    const { rerender } = render(
      <ReportIndexProvider>
        <Harness />
      </ReportIndexProvider>,
    )

    expect(screen.getByTestId('personal-report-codes')).toHaveTextContent(
      'persisted-personal',
    )
    expect(screen.getByTestId('guild-report-codes')).toHaveTextContent(
      'persisted-guild',
    )

    personalReportsQueryResult = createRecentReportsQueryResult({
      reports: [createPersonalReport('remote-personal', 2)],
      hasFetched: true,
      hasFetchedSuccessfully: true,
      error: null,
    })
    guildReportsQueryResult = createGuildReportsQueryResult({
      reports: [createGuildReport('remote-guild', 2)],
      hasFetched: true,
      hasFetchedSuccessfully: true,
      error: null,
    })

    rerender(
      <ReportIndexProvider>
        <Harness />
      </ReportIndexProvider>,
    )

    expect(screen.getByTestId('personal-report-codes')).toHaveTextContent(
      'remote-personal',
    )
    expect(screen.getByTestId('guild-report-codes')).toHaveTextContent(
      'remote-guild',
    )
  })
})
