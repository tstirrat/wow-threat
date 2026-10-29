/**
 * Tests for the rail footer account control and theme toggle.
 */
import type { AuthContextValue } from '@/auth/auth-provider'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RailAccount } from './rail-account'

const useAuthMock = vi.fn()
const refreshMock = vi.fn(async () => {})

vi.mock('@/auth/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}))
vi.mock('@/hooks/use-wcl-rate-limit', () => ({
  useWclRateLimit: () => ({
    rateLimit: {
      limitPerHour: 12000,
      pointsSpentThisHour: 4184.5,
      pointsResetIn: 1740,
    },
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: refreshMock,
  }),
}))

const auth = (overrides: Partial<AuthContextValue>): AuthContextValue =>
  ({
    authEnabled: true,
    isBusy: false,
    isInitializing: false,
    signOut: vi.fn(),
    startWclLogin: vi.fn(),
    wclUserId: null,
    wclUserName: null,
    ...overrides,
  }) as AuthContextValue

describe('RailAccount', () => {
  beforeEach(() => {
    refreshMock.mockClear()
  })

  it('shows sign in and starts the WCL login when signed out', async () => {
    const startWclLogin = vi.fn()
    useAuthMock.mockReturnValue(auth({ startWclLogin }))
    render(<RailAccount />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Sign in with WCL' }),
    )

    expect(startWclLogin).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: /Toggle theme/ }),
    ).toBeInTheDocument()
  })

  it('opens the signed-in menu with rate limit details and sign out', async () => {
    const signOut = vi.fn()
    useAuthMock.mockReturnValue(
      auth({ wclUserId: '12345', wclUserName: 'TestUser', signOut }),
    )
    render(<RailAccount />)

    await userEvent.click(screen.getByRole('button', { name: /TestUser/ }))

    expect(screen.getByText('WCL ID: 12345')).toBeInTheDocument()
    expect(screen.getByText('Spent: 4184/12000')).toBeInTheDocument()
    expect(screen.getByText('Reset: 29m 0s')).toBeInTheDocument()
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('menuitem', { name: 'Warcraft Logs' }),
    ).toHaveAttribute('href', 'https://www.warcraftlogs.com')

    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('shows auth disabled text', () => {
    useAuthMock.mockReturnValue(auth({ authEnabled: false }))
    render(<RailAccount />)

    expect(screen.getByText('Auth disabled')).toBeInTheDocument()
  })

  it('shows loading and busy placeholders', () => {
    useAuthMock.mockReturnValue(auth({ isInitializing: true }))
    const { unmount } = render(<RailAccount />)
    expect(screen.getByTestId('auth-header-loading-skeleton')).toBeVisible()
    unmount()

    useAuthMock.mockReturnValue(auth({ isBusy: true }))
    render(<RailAccount />)
    expect(screen.getByTestId('auth-header-busy-skeleton')).toHaveTextContent(
      'Logging in...',
    )
  })

  it('shows tooltips on the collapsed sign in and theme buttons', async () => {
    useAuthMock.mockReturnValue(auth({}))
    render(<RailAccount collapsed />)

    await userEvent.hover(
      screen.getByRole('button', { name: 'Sign in with WCL' }),
    )
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Sign in with WCL',
    )

    await userEvent.hover(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Toggle theme')
  })

  it('renders icon-only controls when collapsed', async () => {
    const startWclLogin = vi.fn()
    useAuthMock.mockReturnValue(auth({ startWclLogin }))
    const { unmount } = render(<RailAccount collapsed />)

    const signIn = screen.getByRole('button', { name: 'Sign in with WCL' })
    expect(signIn).not.toHaveTextContent('Sign in')
    await userEvent.click(signIn)
    expect(startWclLogin).toHaveBeenCalledTimes(1)
    unmount()

    useAuthMock.mockReturnValue(
      auth({ wclUserId: '12345', wclUserName: 'TestUser' }),
    )
    render(<RailAccount collapsed />)
    await userEvent.click(screen.getByRole('button', { name: 'TestUser' }))
    expect(screen.getByText('WCL ID: 12345')).toBeInTheDocument()
  })
})
