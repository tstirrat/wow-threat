/**
 * Unit tests for auth gate state rendering in RootLayout.
 */
import type { AuthContextValue } from '@/auth/auth-provider'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { RootLayout } from './root-layout'

const useAuthMock = vi.fn()

vi.mock('@/auth/auth-provider', () => ({
  useAuth: () => useAuthMock(),
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
    useAuthMock.mockReturnValue(createMockAuthValue({ isBusy: true }))

    renderLayout('/')

    expect(
      screen.getByRole('heading', { name: 'Completing sign-in' }),
    ).toBeTruthy()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Finishing authentication...',
    )
    expect(
      screen.getByRole('button', { name: 'Finishing sign-in...' }),
    ).toBeDisabled()
  })
})
