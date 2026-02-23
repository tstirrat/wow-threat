/**
 * Unit tests for auth gate state rendering in RootLayout.
 */
import type { AuthContextValue } from '@/auth/auth-provider'
import type { UseWclRateLimitResult } from '@/hooks/use-wcl-rate-limit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { RootLayout } from './root-layout'

const useAuthMock = vi.fn()
const useWclRateLimitMock = vi.fn()

vi.mock('@/auth/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}))
vi.mock('@/hooks/use-wcl-rate-limit', () => ({
  useWclRateLimit: () => useWclRateLimitMock(),
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
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RootLayout', () => {
  it('shows sign-in required state when idle and signed out', () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(createMockAuthValue({ isBusy: false }))

    renderLayout('/')

    expect(
      screen.getByRole('heading', { name: 'Sign in required' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Continue with Warcraft Logs' }),
    ).toBeTruthy()
    expect(screen.queryByText('Finishing authentication...')).toBeNull()
  })

  it('shows completing sign-in loader state while popup flow is finalizing', () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(createMockAuthValue({ isBusy: true }))

    renderLayout('/')

    expect(
      screen.getByRole('heading', { name: 'Completing sign-in' }),
    ).toBeTruthy()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Finishing authentication...',
    )
    expect(
      screen.getByText('Logging in...', {
        selector: 'span',
      }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Sign in with Warcraft Logs' }),
    ).toBeNull()
  })

  it('shows signed-in username in account dropdown trigger', () => {
    useWclRateLimitMock.mockReturnValue(createMockWclRateLimitValue())
    useAuthMock.mockReturnValue(
      createMockAuthValue({
        user: {
          uid: 'wcl:12345',
        } as AuthContextValue['user'],
        wclUserName: 'TestUser',
      }),
    )

    renderLayout('/')

    expect(screen.getByRole('button', { name: /TestUser/i })).toBeTruthy()
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
})
