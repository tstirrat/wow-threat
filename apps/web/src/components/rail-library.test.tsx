/**
 * Unit tests for the rail library sections and sign-in gating.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RailLibrary } from './rail-library'

const authState = vi.hoisted(() => ({
  authEnabled: true,
  wclUserId: null as string | null,
}))
const indexState = vi.hoisted(() => ({
  recentReports: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/auth/auth-provider', () => ({ useAuth: () => authState }))
vi.mock('../hooks/use-user-settings', () => ({
  useUserSettings: () => ({
    settings: { starredReports: [], starredEntities: [] },
    toggleStarredReport: vi.fn(),
    unstarReport: vi.fn(),
  }),
}))
vi.mock('../hooks/use-report-index', () => ({
  useReportIndex: () => ({
    recentReports: indexState.recentReports,
    removeRecentReport: vi.fn(),
    personalReports: [],
    guildReports: [],
    isLoadingPersonalReports: false,
    isRefreshingPersonalReports: false,
    personalReportsError: null,
    isLoadingGuildReports: false,
    isRefreshingGuildReports: false,
    guildReportsError: null,
    refreshPersonalReports: vi.fn(),
    refreshGuildReports: vi.fn(),
  }),
}))

const renderLibrary = () =>
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <RailLibrary />
    </MemoryRouter>,
  )

describe('RailLibrary', () => {
  beforeEach(() => {
    authState.wclUserId = null
    indexState.recentReports = []
  })

  it('renders empty states for every section and the sign-in prompt', () => {
    renderLibrary()

    expect(screen.getByRole('region', { name: 'Starred' })).toBeVisible()
    expect(screen.getByText('No starred reports')).toBeVisible()
    expect(screen.getByRole('region', { name: 'Recent logs' })).toBeVisible()
    expect(screen.getByText(/Reports you open appear here/)).toBeVisible()
    expect(screen.getByText('No guild reports yet')).toBeVisible()
    expect(screen.getByText('Sign in for personal logs.')).toBeVisible()
  })

  it('shows personal logs and a refresh button when signed in', () => {
    authState.wclUserId = '42'
    renderLibrary()

    expect(
      screen.getByText('No recent Warcraft Logs history yet'),
    ).toBeVisible()
    expect(screen.queryByText('Sign in for personal logs.')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Refresh' })).toHaveLength(2)
  })

  it('lists recent reports as links', () => {
    indexState.recentReports = [
      {
        reportId: 'abc123',
        title: 'Karazhan Night',
        sourceHost: 'fresh.warcraftlogs.com',
        lastOpenedAt: 1_707_000_000_000,
      },
    ]
    renderLibrary()

    expect(
      screen.getByRole('link', { name: /Karazhan Night/ }),
    ).toHaveAttribute('href', '/report/abc123')
  })
})
