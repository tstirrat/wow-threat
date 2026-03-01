/**
 * Unit tests for Firestore-backed user settings context.
 */
import type { AuthContextValue } from '@/auth/auth-provider'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type UserSettings,
  UserSettingsProvider,
  useUserSettings,
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
        showBossMelee: true,
        showAllBossDamageEvents: false,
        showEnergizeEvents: false,
        showPets: false,
        starredReports: [],
        starredEntities: [],
      },
    exists: () => exists,
  }
}

function Harness(): JSX.Element {
  const {
    settings,
    isLoading,
    error,
    updateSettings,
    toggleStarredReport,
    toggleStarredEntity,
  } = useUserSettings()

  return (
    <div>
      <p data-testid="is-loading">{String(isLoading)}</p>
      <p data-testid="infer-threat-reduction">
        {String(settings.inferThreatReduction)}
      </p>
      <p data-testid="error">{error?.message ?? ''}</p>
      <p data-testid="starred-count">
        {String(settings.starredReports.length)}
      </p>
      <p data-testid="starred-entity-count">
        {String(settings.starredEntities.length)}
      </p>
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
      <button
        type="button"
        onClick={() => {
          void toggleStarredReport({
            reportId: 'ABC123',
            title: 'Test report',
            sourceHost: 'fresh.warcraftlogs.com',
          })
        }}
      >
        toggle starred report
      </button>
      <button
        type="button"
        onClick={() => {
          void toggleStarredEntity({
            entityType: 'guild',
            entityId: '777',
            name: 'Threat Guild',
            sourceHost: 'fresh.warcraftlogs.com',
          })
        }}
      >
        toggle starred entity
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
            showBossMelee: true,
            showAllBossDamageEvents: false,
            showEnergizeEvents: false,
            showPets: false,
            starredReports: [],
            starredEntities: [],
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
      screen
        .getByRole('button', {
          name: 'toggle infer threat reduction',
        })
        .click()
    })

    expect(screen.getByTestId('infer-threat-reduction')).toHaveTextContent(
      'false',
    )
    expect(screen.getByTestId('error')).toHaveTextContent('write failed')
  })

  it('toggles starred reports and writes full settings payload', async () => {
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

    const existingStarred = {
      reportId: 'OLD123',
      title: 'Older report',
      sourceHost: 'sod.warcraftlogs.com',
      starredAt: 10,
    }
    act(() => {
      nextSnapshot?.(
        createSnapshot({
          exists: true,
          settings: {
            inferThreatReduction: false,
            showBossMelee: true,
            showAllBossDamageEvents: false,
            showEnergizeEvents: false,
            showPets: false,
            starredReports: [existingStarred],
            starredEntities: [],
          },
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
    })

    await act(async () => {
      screen
        .getByRole('button', {
          name: 'toggle starred report',
        })
        .click()
    })

    expect(screen.getByTestId('starred-count')).toHaveTextContent('2')
    expect(setDocMock).toHaveBeenCalledWith(
      'settings-doc-ref',
      expect.objectContaining({
        showPets: false,
        showEnergizeEvents: false,
        showBossMelee: true,
        showAllBossDamageEvents: false,
        inferThreatReduction: false,
        starredReports: expect.arrayContaining([
          expect.objectContaining({
            reportId: 'ABC123',
            title: 'Test report',
            sourceHost: 'fresh.warcraftlogs.com',
          }),
          expect.objectContaining({
            reportId: 'OLD123',
            title: 'Older report',
          }),
        ]),
        starredEntities: [],
      }),
      {
        merge: true,
      },
    )
  })

  it('toggles starred entities and writes full settings payload', async () => {
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

    await act(async () => {
      screen
        .getByRole('button', {
          name: 'toggle starred entity',
        })
        .click()
    })

    expect(screen.getByTestId('starred-entity-count')).toHaveTextContent('1')
    expect(setDocMock).toHaveBeenCalledWith(
      'settings-doc-ref',
      expect.objectContaining({
        starredEntities: expect.arrayContaining([
          expect.objectContaining({
            entityType: 'guild',
            entityId: '777',
            name: 'Threat Guild',
          }),
        ]),
      }),
      {
        merge: true,
      },
    )
  })
})
