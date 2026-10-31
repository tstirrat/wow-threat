/**
 * Unit tests for the rail library sections and sign-in gating.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RailLibrary } from './rail-library'

const authState = vi.hoisted(() => ({
  authEnabled: true,
  wclUserId: null as string | null,
}))
const indexState = vi.hoisted(() => ({
  recentReports: [] as Array<Record<string, unknown>>,
  guildReports: [] as Array<Record<string, unknown>>,
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
    guildReports: indexState.guildReports,
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
    indexState.guildReports = []
  })

  it('renders empty states for every section and the sign-in prompt', () => {
    renderLibrary()

    expect(screen.getByRole('region', { name: 'Starred logs' })).toBeVisible()
    expect(screen.getByText('No starred reports')).toBeVisible()
    expect(screen.getByRole('region', { name: 'Recent logs' })).toBeVisible()
    expect(screen.getByText(/Reports you open appear here/)).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Starred guild logs' }),
    ).toBeVisible()
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

  it('groups guild reports under collapsed guild headings', async () => {
    const user = userEvent.setup()
    indexState.guildReports = [
      {
        reportId: 'g1',
        title: 'Wednesday Raid',
        startTime: 1_707_000_000_000,
        endTime: 1_707_003_600_000,
        zoneName: 'Naxxramas',
        guildId: '7',
        guildName: 'Threat Guild',
        guildFaction: 'Horde',
        sourceHost: 'fresh.warcraftlogs.com',
      },
    ]
    renderLibrary()

    const trigger = screen.getByRole('button', { name: /<Threat Guild>/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: /Wednesday Raid/ })).toBeNull()

    await user.click(trigger)

    expect(screen.getByRole('link', { name: /Wednesday Raid/ })).toBeVisible()
  })
})
