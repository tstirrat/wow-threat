/**
 * Firebase authentication provider and WCL bridge actions.
 */
import type { User } from 'firebase/auth'
import {
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithCustomToken,
} from 'firebase/auth'
import {
  type FC,
  type PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

import { defaultApiBaseUrl } from '../lib/constants'
import { getFirebaseAuth, isFirebaseAuthEnabled } from '../lib/firebase'
import {
  type WclAuthPopupResult,
  clearWclAuthPopupResult,
  parseWclAuthPopupResult,
  wclAuthPopupResultStorageKey,
} from './wcl-popup-bridge'

interface FirebaseCustomTokenResponse {
  customToken: string
}

export interface AuthContextValue {
  authEnabled: boolean
  authError: string | null
  completeBridgeSignIn: (bridgeCode: string) => Promise<void>
  isBusy: boolean
  isInitializing: boolean
  signOut: () => Promise<void>
  startWclLogin: () => void
  user: User | null
}

const AuthContext = createContext<AuthContextValue | null>(null)
const popupWidthPx = 520
const popupHeightPx = 760
const popupPollIntervalMs = 250
const popupClosedResultGraceMs = 1000
const popupTimeoutMs = 3 * 60 * 1000

async function parseErrorMessage(response: Response): Promise<string> {
  const body = await response.text()
  if (!body) {
    return `Request failed with status ${response.status}`
  }

  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown }
    }
    if (typeof parsed.error?.message === 'string') {
      return parsed.error.message
    }
  } catch {
    // Fall through and return raw text.
  }

  return body
}

function buildPopupFeatures(): string {
  const left = Math.max(
    (window.outerWidth - popupWidthPx) / 2 + window.screenX,
    0,
  )
  const top = Math.max(
    (window.outerHeight - popupHeightPx) / 2 + window.screenY,
    0,
  )

  return [
    'popup=yes',
    `width=${popupWidthPx}`,
    `height=${popupHeightPx}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    'resizable=yes',
    'scrollbars=yes',
  ].join(',')
}

function openWclLoginPopup(loginUrl: string): Window | null {
  return window.open(loginUrl, 'wow-threat-wcl-auth', buildPopupFeatures())
}

function waitForWclPopupResult(
  popupWindow: Window,
  flowStartMs: number,
): Promise<WclAuthPopupResult> {
  return new Promise((resolve, reject) => {
    let intervalId = 0
    let timeoutId = 0
    let popupClosedAtMs: number | null = null
    let completed = false

    function complete(callback: () => void): void {
      if (completed) {
        return
      }

      completed = true
      window.removeEventListener('storage', onStorage)
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
      callback()
    }

    function maybeResolveResult(rawValue: string | null): boolean {
      const parsedResult = parseWclAuthPopupResult(rawValue)
      if (!parsedResult || parsedResult.createdAtMs < flowStartMs) {
        return false
      }

      complete(() => {
        clearWclAuthPopupResult()
        resolve(parsedResult)
      })

      return true
    }

    function onStorage(event: StorageEvent): void {
      if (event.key !== wclAuthPopupResultStorageKey) {
        return
      }

      maybeResolveResult(event.newValue)
    }

    window.addEventListener('storage', onStorage)

    if (
      maybeResolveResult(
        window.localStorage.getItem(wclAuthPopupResultStorageKey),
      )
    ) {
      return
    }

    intervalId = window.setInterval(() => {
      if (
        maybeResolveResult(
          window.localStorage.getItem(wclAuthPopupResultStorageKey),
        )
      ) {
        return
      }

      if (popupWindow.closed) {
        const nowMs = Date.now()
        if (popupClosedAtMs === null) {
          popupClosedAtMs = nowMs
          return
        }

        if (nowMs - popupClosedAtMs < popupClosedResultGraceMs) {
          return
        }

        if (
          maybeResolveResult(
            window.localStorage.getItem(wclAuthPopupResultStorageKey),
          )
        ) {
          return
        }

        complete(() => {
          reject(
            new Error(
              'Sign-in window was closed before authentication completed.',
            ),
          )
        })
        return
      }

      popupClosedAtMs = null
    }, popupPollIntervalMs)

    timeoutId = window.setTimeout(() => {
      complete(() => {
        reject(new Error('Timed out waiting for Warcraft Logs authentication.'))
      })
    }, popupTimeoutMs)
  })
}

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const authEnabled = isFirebaseAuthEnabled
  const auth = getFirebaseAuth()
  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState<boolean>(authEnabled)
  const [isBusy, setIsBusy] = useState<boolean>(false)

  useEffect(() => {
    if (!authEnabled || !auth) {
      setIsInitializing(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setIsInitializing(false)
    })

    return () => {
      unsubscribe()
    }
  }, [auth, authEnabled])

  useEffect(() => {
    if (user) {
      setAuthError(null)
    }
  }, [user])

  const exchangeBridgeCodeForCustomToken = async (
    bridgeCode: string,
  ): Promise<void> => {
    if (!authEnabled || !auth) {
      throw new Error('Firebase auth is not configured')
    }

    const response = await fetch(
      `${defaultApiBaseUrl}/auth/firebase-custom-token`,
      {
        body: JSON.stringify({
          bridgeCode,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    )

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response))
    }

    const payload = (await response.json()) as FirebaseCustomTokenResponse
    await signInWithCustomToken(auth, payload.customToken)
  }

  const startWclLogin = (): void => {
    if (!authEnabled || isBusy) {
      return
    }

    setAuthError(null)
    setIsBusy(true)

    const loginUrl = new URL('/auth/wcl/login', defaultApiBaseUrl)
    loginUrl.searchParams.set('origin', window.location.origin)
    clearWclAuthPopupResult()

    const popupWindow = openWclLoginPopup(loginUrl.toString())
    if (!popupWindow) {
      setAuthError(
        'Unable to open the sign-in window. Disable popup blocking and try again.',
      )
      setIsBusy(false)
      return
    }

    const flowStartMs = Date.now()
    void waitForWclPopupResult(popupWindow, flowStartMs)
      .then(async (result) => {
        if (result.status === 'error') {
          throw new Error(result.message)
        }

        await exchangeBridgeCodeForCustomToken(result.bridgeCode)
      })
      .catch((error: unknown) => {
        const nextMessage =
          error instanceof Error ? error.message : 'Unable to complete sign-in.'
        setAuthError(nextMessage)
      })
      .finally(() => {
        clearWclAuthPopupResult()
        if (!popupWindow.closed) {
          popupWindow.close()
        }
        setIsBusy(false)
      })
  }

  const completeBridgeSignIn = async (bridgeCode: string): Promise<void> => {
    if (!authEnabled || !auth) {
      throw new Error('Firebase auth is not configured')
    }

    setAuthError(null)
    setIsBusy(true)
    try {
      await exchangeBridgeCodeForCustomToken(bridgeCode)
    } finally {
      setIsBusy(false)
    }
  }

  const signOut = async (): Promise<void> => {
    if (!authEnabled || !auth) {
      return
    }

    setIsBusy(true)
    try {
      const currentUser = auth.currentUser
      const idToken = currentUser ? await currentUser.getIdToken() : null

      if (idToken) {
        await fetch(`${defaultApiBaseUrl}/auth/logout`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          method: 'POST',
        })
      }
    } finally {
      await firebaseSignOut(auth)
      setAuthError(null)
      setIsBusy(false)
    }
  }

  const value: AuthContextValue = {
    authEnabled,
    authError,
    completeBridgeSignIn,
    isBusy,
    isInitializing,
    signOut,
    startWclLogin,
    user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Read auth context. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
