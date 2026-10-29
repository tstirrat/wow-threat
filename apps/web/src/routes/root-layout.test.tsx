/**
 * Unit tests for RootLayout account controls and shell behavior.
 */
import type { AuthContextValue } from '@/auth/auth-provider'
import type { UseWclRateLimitResult } from '@/hooks/use-wcl-rate-limit'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RootLayout } from './root-layout'

const useAuthMock = vi.fn()
const useWclRateLimitMock = vi.fn()
const addRecentReportMock = vi.fn()
const searchReportsMock = vi.fn()
const useReportIndexMock = vi.fn()
const getReportMock = vi.fn()
const useUserSettingsMock = vi.fn()

vi.mock('@/auth/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}))
vi.mock('@/hooks/use-wcl-rate-limit', () => ({
  useWclRateLimit: () => useWclRateLimitMock(),
}))
vi.mock('@/hooks/use-report-index', () => ({
  useReportIndex: () => useReportIndexMock(),
}))
vi.mock('@/hooks/use-user-settings', () => ({
  useUserSettings: () => useUserSettingsMock(),
}))
vi.mock('@/api/reports', () => ({
  getReport: (...args: unknown[]) => getReportMock(...args),
}))
vi.mock('posthog-js/react', () => ({
  usePostHog: () => null,
}))
vi.mock('@/components/rail-library', () => ({
  RailLibrary: () => <div data-testid="rail-library-stub" />,
}))
vi.mock('@/hooks/use-page-view-tracking', () => ({
  usePageViewTracking: () => undefined,
}))

function createMockAuthValue(
  overrides: Partial<AuthContextValue>,
): AuthContextValue {
  return {
    authEnabled: true,
    authError: null,
    completeBridgeSignIn: vi.fn(),
    isBusy: false,
    isInitializing: false,
    signOut: vi.fn(),
    startWclLogin: vi.fn(),
    user: null,
    wclUserId: null,
    wclUserName: null,
    ...overrides,
  }
}

function createMockWclRateLimitValue(
  overrides: Partial<UseWclRateLimitResult> = {},
): UseWclRateLimitResult {
  return {
    rateLimit: null,
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: vi.fn(async () => {}),
    ...overrides,
  }
}

function renderLayout(pathname = '/'): void {
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={[pathname]}
    >
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<p>child outlet</p>} />
          <Route path="report/:reportId" element={<p>report route</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RootLayout', () => {
  beforeEach(() => {
    searchReportsMock.mockReturnValue([])
    useReportIndexMock.mockReturnValue({
      addRecentReport: addRecentReportMock,
      searchReports: searchReportsMock,
    })
    useUserSettingsMock.mockReturnValue({
      settings: {
        showPets: false,
        showFixateBands: true,
        showEnergizeEvents: false,
        inferThreatReduction: false,
        starredReports: [],
        starredEntities: [],
      },
      isLoading: false,
    })
  })

  it('shows sign-in button but keeps outlet visible when signed out', () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(createMockAuthValue({ isBusy: false }))

    renderLayout('/')

    expect(
      screen.getByRole('button', { name: 'Sign in with WCL' }),
    ).toBeTruthy()
    expect(screen.getByText('child outlet')).toBeTruthy()
  })

  it('shows header busy state while popup flow is finalizing', () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(createMockAuthValue({ isBusy: true }))

    renderLayout('/')

    expect(screen.getByTestId('auth-header-busy-skeleton')).toBeTruthy()
    expect(screen.getByText('Logging in...')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Sign in with WCL' }),
    ).toBeNull()
  })

  it('shows a loading skeleton while auth initialization is in progress', () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(
      createMockAuthValue({
        isInitializing: true,
      }),
    )

    renderLayout('/')

    expect(screen.getByTestId('auth-header-loading-skeleton')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Sign in with WCL' }),
    ).toBeNull()
  })

  it('shows signed-in username in account dropdown trigger', () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(
      createMockAuthValue({
        user: {
          uid: 'wcl:12345',
        } as AuthContextValue['user'],
        wclUserId: '12345',
        wclUserName: 'TestUser',
      }),
    )

    renderLayout('/')

    expect(screen.getByRole('button', { name: /TestUser/i })).toBeTruthy()
  })

  it('does not render a home icon link in the app bar', () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(createMockAuthValue({ isBusy: false }))

    renderLayout('/')

    expect(screen.queryByRole('link', { name: 'Go to home' })).toBeNull()
    expect(
      within(screen.getByTestId('app-bar')).queryByRole('button', {
        name: 'Sign in with WCL',
      }),
    ).toBeNull()
    expect(
      within(screen.getByTestId('rail-account')).getByRole('button', {
        name: 'Sign in with WCL',
      }),
    ).toBeTruthy()
  })

  it('shows wcl api rate limit details inside the account dropdown', async () => {
    const refreshMock = vi.fn(async () => {})
    useWclRateLimitMock.mockReturnValue(
      createMockWclRateLimitValue({
        rateLimit: {
          limitPerHour: 12000,
          pointsSpentThisHour: 4184.5,
          pointsResetIn: 1740,
        },
        refresh: refreshMock,
      }),
    )
    useAuthMock.mockReturnValue(
      createMockAuthValue({
        user: {
          uid: 'wcl:12345',
        } as AuthContextValue['user'],
        wclUserId: '12345',
        wclUserName: 'TestUser',
      }),
    )

    renderLayout('/')

    await userEvent.click(screen.getByRole('button', { name: /TestUser/i }))

    expect(screen.getByText('Spent: 4184/12000')).toBeTruthy()
    expect(screen.getByText('Reset: 29m 0s')).toBeTruthy()
    expect(refreshMock).toHaveBeenCalledTimes(1)

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Refresh WCL rate limit',
      }),
    )
    expect(refreshMock).toHaveBeenCalledTimes(2)
  })

  it('shows the WOW Threat link in the bar only while the rail is collapsed', async () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(createMockAuthValue({ isBusy: false }))

    renderLayout('/')

    expect(screen.queryByTestId('app-bar-brand')).toBeNull()

    await userEvent.click(
      screen.getByRole('button', { name: 'Collapse sidebar' }),
    )
    expect(screen.getByTestId('app-bar-brand')).toHaveAttribute('href', '/')

    await userEvent.click(
      screen.getByRole('button', { name: 'Expand sidebar' }),
    )
    expect(screen.queryByTestId('app-bar-brand')).toBeNull()
  })

  it('shows report input by default on the landing page', () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(createMockAuthValue({ isBusy: false }))

    renderLayout('/')

    expect(screen.getByLabelText('Open report')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Open report input' }),
    ).toBeNull()
  })

  it('opens hidden report input from icon outside the landing page', async () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(createMockAuthValue({ isBusy: false }))

    renderLayout('/report/abc123')

    expect(screen.getByTestId('report-input-container')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    const openReportInputButton = screen.getByRole('button', {
      name: 'Open report input',
    })
    expect(openReportInputButton).toHaveTextContent('Open report')
    expect(screen.queryByLabelText('Report input shortcut')).toBeNull()
    await userEvent.click(openReportInputButton)
    expect(screen.getByTestId('report-input-container')).toHaveAttribute(
      'aria-hidden',
      'false',
    )
    expect(screen.getByLabelText('Open report')).toBeTruthy()
  })

  it('does not render a starred dropdown and orders bar sections', () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(
      createMockAuthValue({
        user: {
          uid: 'wcl:12345',
        } as AuthContextValue['user'],
        wclUserId: '12345',
      }),
    )

    renderLayout('/report/abc123')

    expect(screen.queryByRole('button', { name: /Starred/i })).toBeNull()

    const bar = screen.getByTestId('app-bar')
    const order = [
      screen.getByTestId('report-input-container'),
      screen.getByTestId('app-bar-title'),
    ]
    expect(bar).toContainElement(order[0] as HTMLElement)
    order.slice(1).forEach((el, i) => {
      const prev = order[i] as HTMLElement
      expect(
        prev.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })
  })

  it('opens report input with cmd/ctrl+o shortcut', async () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(createMockAuthValue({ isBusy: false }))

    renderLayout('/report/abc123')

    await userEvent.keyboard('{Meta>}o{/Meta}')

    const reportInput = screen.getByLabelText('Open report')
    expect(reportInput).toBeTruthy()
    reportInput.focus()
    expect(reportInput).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByTestId('report-input-container')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'Open report input' }),
    ).toBeTruthy()
  })

  it('collapses report input when it blurs outside the form on non-landing pages', async () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(createMockAuthValue({ isBusy: false }))

    renderLayout('/report/abc123')

    await userEvent.click(
      screen.getByRole('button', { name: 'Open report input' }),
    )

    const reportInput = screen.getByLabelText('Open report')
    expect(reportInput).toBeTruthy()
    reportInput.focus()
    expect(reportInput).toHaveFocus()

    await userEvent.click(
      screen.getByRole('button', { name: 'Sign in with WCL' }),
    )

    expect(screen.getByTestId('report-input-container')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'Open report input' }),
    ).toBeTruthy()
  })
})
