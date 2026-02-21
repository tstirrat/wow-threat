/**
 * Unit tests for popup-based authentication orchestration in AuthProvider.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Auth } from 'firebase/auth'
import { type FC } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, useAuth } from './auth-provider'
import { wclAuthPopupResultStorageKey } from './wcl-popup-bridge'

const onAuthStateChangedMock = vi.fn()
const signInWithCustomTokenMock = vi.fn()
const firebaseSignOutMock = vi.fn()
const getFirebaseAuthMock = vi.fn()

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
  signInWithCustomToken: (...args: unknown[]) =>
    signInWithCustomTokenMock(...args),
  signOut: (...args: unknown[]) => firebaseSignOutMock(...args),
}))

vi.mock('../lib/firebase', () => ({
  getFirebaseAuth: (): Auth => getFirebaseAuthMock(),
  isFirebaseAuthEnabled: true,
}))

const fakeAuth = {
  currentUser: null,
} as unknown as Auth

const AuthHarness: FC = () => {
  const { authError, isBusy, startWclLogin } = useAuth()

  return (
    <div>
      <button type="button" onClick={startWclLogin}>
        start login
      </button>
      <p data-testid="auth-error">{authError ?? ''}</p>
      <p data-testid="busy-state">{isBusy ? 'busy' : 'idle'}</p>
    </div>
  )
}

describe('AuthProvider', () => {
  let originalLocalStorage: Storage

  beforeEach(() => {
    getFirebaseAuthMock.mockReturnValue(fakeAuth)
    onAuthStateChangedMock.mockImplementation(
      (_auth: Auth, callback: (user: null) => void) => {
        callback(null)
        return vi.fn()
      },
    )
    signInWithCustomTokenMock.mockResolvedValue(undefined)
    firebaseSignOutMock.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', vi.fn())

    originalLocalStorage = window.localStorage
    const values = new Map<string, string>()
    const mockLocalStorage = {
      clear: (): void => {
        values.clear()
      },
      getItem: (key: string): string | null => values.get(key) ?? null,
      key: (index: number): string | null =>
        Array.from(values.keys())[index] ?? null,
      get length(): number {
        return values.size
      },
      removeItem: (key: string): void => {
        values.delete(key)
      },
      setItem: (key: string, value: string): void => {
        values.set(key, value)
      },
    } satisfies Storage

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: mockLocalStorage,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    })
  })

  it('opens popup and exchanges bridge code when callback succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        customToken: 'firebase-custom-token',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const popupCloseSpy = vi.fn()
    const popupWindow = {
      close: popupCloseSpy,
      closed: false,
    } as unknown as Window
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popupWindow)
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'start login' }))

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/wcl/login?origin='),
      'wow-threat-wcl-auth',
      expect.any(String),
    )

    const successPayload = JSON.stringify({
      bridgeCode: 'bridge-code-123',
      createdAtMs: Date.now() + 1,
      status: 'success',
    })
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: wclAuthPopupResultStorageKey,
        newValue: successPayload,
      }),
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/firebase-custom-token'),
        expect.objectContaining({
          method: 'POST',
        }),
      )
    })
    await waitFor(() => {
      expect(signInWithCustomTokenMock).toHaveBeenCalledWith(
        fakeAuth,
        'firebase-custom-token',
      )
    })
    await waitFor(() => {
      expect(popupCloseSpy).toHaveBeenCalled()
    })

    expect(screen.getByTestId('auth-error')).toHaveTextContent('')
  })

  it('sets an error when popup is blocked', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'start login' }))

    expect(screen.getByTestId('auth-error')).toHaveTextContent(
      'Unable to open the sign-in window. Disable popup blocking and try again.',
    )
    expect(screen.getByTestId('busy-state')).toHaveTextContent('idle')
  })

  it('sets an error when popup reports callback failure', async () => {
    const popupWindow = {
      close: vi.fn(),
      closed: false,
    } as unknown as Window
    vi.spyOn(window, 'open').mockReturnValue(popupWindow)
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'start login' }))

    const errorPayload = JSON.stringify({
      createdAtMs: Date.now() + 1,
      message: 'WCL callback rejected',
      status: 'error',
    })
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: wclAuthPopupResultStorageKey,
        newValue: errorPayload,
      }),
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth-error')).toHaveTextContent(
        'WCL callback rejected',
      )
    })
  })
})
