/**
 * Unit tests for Firestore-backed user settings context.
 */
import type { AuthContextValue } from '@/auth/auth-provider'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  UserSettingsProvider,
  useUserSettings,
  type UserSettings,
} from './use-user-settings'

const useAuthMock = vi.fn()
const getFirebaseFirestoreMock = vi.fn()
const docMock = vi.fn()
const onSnapshotMock = vi.fn()
const setDocMock = vi.fn()

vi.mock('@/auth/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../lib/firebase', () => ({
  getFirebaseFirestore: () => getFirebaseFirestoreMock(),
}))

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => docMock(...args),
  onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
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
    user: null,
    wclUserId: null,
    wclUserName: null,
    ...overrides,
  }
}

function createSnapshot({
  exists,
  settings,
}: {
  exists: boolean
  settings?: UserSettings
}): {
  data: () => UserSettings
  exists: () => boolean
} {
  return {
    data: () =>
      settings ?? {
        inferThreatReduction: false,
        showEnergizeEvents: false,
        showPets: false,
      },
    exists: () => exists,
  }
}

function Harness(): JSX.Element {
  const { settings, isLoading, error, updateSettings } = useUserSettings()

  return (
    <div>
      <p data-testid="is-loading">{String(isLoading)}</p>
      <p data-testid="infer-threat-reduction">
        {String(settings.inferThreatReduction)}
      </p>
      <p data-testid="error">{error?.message ?? ''}</p>
      <button
        type="button"
        onClick={() => {
          void updateSettings({
            inferThreatReduction: !settings.inferThreatReduction,
          })
        }}
      >
        toggle infer threat reduction
      </button>
    </div>
  )
}

describe('UserSettingsProvider', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    getFirebaseFirestoreMock.mockReset()
    docMock.mockReset()
    onSnapshotMock.mockReset()
    setDocMock.mockReset()

    getFirebaseFirestoreMock.mockReturnValue({
      id: 'firestore',
    })
    docMock.mockReturnValue({
      withConverter: () => 'settings-doc-ref',
    })
    setDocMock.mockResolvedValue(undefined)
  })

  it('returns defaults without loading for signed-out users', () => {
    useAuthMock.mockReturnValue(createAuthValue({ user: null }))

    render(
      <UserSettingsProvider>
        <Harness />
      </UserSettingsProvider>,
    )

    expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
    expect(screen.getByTestId('infer-threat-reduction')).toHaveTextContent(
      'false',
    )
    expect(onSnapshotMock).not.toHaveBeenCalled()
  })

  it('stays loading for signed-in users until first snapshot arrives', async () => {
    useAuthMock.mockReturnValue(
      createAuthValue({
        user: {
          uid: 'wcl:12345',
        } as User,
      }),
    )

    let nextSnapshot:
      | ((snapshot: ReturnType<typeof createSnapshot>) => void)
      | undefined
    onSnapshotMock.mockImplementation(
      (
        _documentRef: unknown,
        onNext: (snapshot: ReturnType<typeof createSnapshot>) => void,
      ) => {
        nextSnapshot = onNext
        return vi.fn()
      },
    )

    render(
      <UserSettingsProvider>
        <Harness />
      </UserSettingsProvider>,
    )

    expect(screen.getByTestId('is-loading')).toHaveTextContent('true')

    act(() => {
      nextSnapshot?.(
        createSnapshot({
          exists: true,
          settings: {
            inferThreatReduction: true,
            showEnergizeEvents: false,
            showPets: false,
          },
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('infer-threat-reduction')).toHaveTextContent(
      'true',
    )
  })

  it('uses defaults when snapshot document does not exist', async () => {
    useAuthMock.mockReturnValue(
      createAuthValue({
        user: {
          uid: 'wcl:12345',
        } as User,
      }),
    )

    let nextSnapshot:
      | ((snapshot: ReturnType<typeof createSnapshot>) => void)
      | undefined
    onSnapshotMock.mockImplementation(
      (
        _documentRef: unknown,
        onNext: (snapshot: ReturnType<typeof createSnapshot>) => void,
      ) => {
        nextSnapshot = onNext
        return vi.fn()
      },
    )

    render(
      <UserSettingsProvider>
        <Harness />
      </UserSettingsProvider>,
    )

    act(() => {
      nextSnapshot?.(createSnapshot({ exists: false }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('infer-threat-reduction')).toHaveTextContent(
      'false',
    )
  })

  it('optimistically updates and rolls back when Firestore write fails', async () => {
    useAuthMock.mockReturnValue(
      createAuthValue({
        user: {
          uid: 'wcl:12345',
        } as User,
      }),
    )
    setDocMock.mockRejectedValue(new Error('write failed'))

    let nextSnapshot:
      | ((snapshot: ReturnType<typeof createSnapshot>) => void)
      | undefined
    onSnapshotMock.mockImplementation(
      (
        _documentRef: unknown,
        onNext: (snapshot: ReturnType<typeof createSnapshot>) => void,
      ) => {
        nextSnapshot = onNext
        return vi.fn()
      },
    )

    render(
      <UserSettingsProvider>
        <Harness />
      </UserSettingsProvider>,
    )

    act(() => {
      nextSnapshot?.(createSnapshot({ exists: false }))
    })
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
    })

    await act(async () => {
      screen.getByRole('button', {
        name: 'toggle infer threat reduction',
      }).click()
    })

    expect(screen.getByTestId('infer-threat-reduction')).toHaveTextContent(
      'false',
    )
    expect(screen.getByTestId('error')).toHaveTextContent('write failed')
  })
})
