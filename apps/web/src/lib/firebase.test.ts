/**
 * Unit tests for Firebase runtime auth configuration flags.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const initializeAppMock = vi.fn(() => ({
  name: 'firebase-app',
}))
const getAuthMock = vi.fn(() => ({
  name: 'firebase-auth',
}))
const getFirestoreMock = vi.fn(() => ({
  name: 'firebase-firestore',
}))

vi.mock('firebase/app', () => ({
  initializeApp: (...args: unknown[]) => initializeAppMock(...args),
}))

vi.mock('firebase/auth', () => ({
  getAuth: (...args: unknown[]) => getAuthMock(...args),
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => getFirestoreMock(...args),
}))

function setDefaultFirebaseEnv(): void {
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'firebase-api-key')
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'wow-threat')
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'wow-threat.firebaseapp.com')
  vi.stubEnv('VITE_FIREBASE_APP_ID', 'firebase-app-id')
  vi.stubEnv('VITE_DISABLE_AUTH', 'false')
}

async function loadFirebaseModule(): Promise<typeof import('./firebase')> {
  vi.resetModules()
  return import('./firebase')
}

describe('firebase runtime config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('disables auth when VITE_DISABLE_AUTH is enabled', async () => {
    setDefaultFirebaseEnv()
    vi.stubEnv('VITE_DISABLE_AUTH', 'true')

    const firebaseModule = await loadFirebaseModule()

    expect(firebaseModule.isFirebaseAuthEnabled).toBe(false)
    expect(firebaseModule.getFirebaseAuth()).toBeNull()
    expect(firebaseModule.getFirebaseFirestore()).toBeNull()
    expect(initializeAppMock).not.toHaveBeenCalled()
    expect(getAuthMock).not.toHaveBeenCalled()
    expect(getFirestoreMock).not.toHaveBeenCalled()
  })

  it('initializes firebase auth once when enabled', async () => {
    setDefaultFirebaseEnv()

    const firebaseModule = await loadFirebaseModule()

    expect(firebaseModule.isFirebaseAuthEnabled).toBe(true)
    const firstAuth = firebaseModule.getFirebaseAuth()
    const secondAuth = firebaseModule.getFirebaseAuth()

    expect(firstAuth).toEqual({
      name: 'firebase-auth',
    })
    expect(secondAuth).toEqual({
      name: 'firebase-auth',
    })
    expect(initializeAppMock).toHaveBeenCalledTimes(1)
    expect(getAuthMock).toHaveBeenCalledTimes(1)
  })

  it('initializes firestore once when enabled', async () => {
    setDefaultFirebaseEnv()

    const firebaseModule = await loadFirebaseModule()

    const firstFirestore = firebaseModule.getFirebaseFirestore()
    const secondFirestore = firebaseModule.getFirebaseFirestore()

    expect(firstFirestore).toEqual({
      name: 'firebase-firestore',
    })
    expect(secondFirestore).toEqual({
      name: 'firebase-firestore',
    })
    expect(initializeAppMock).toHaveBeenCalledTimes(1)
    expect(getFirestoreMock).toHaveBeenCalledTimes(1)
  })
})
