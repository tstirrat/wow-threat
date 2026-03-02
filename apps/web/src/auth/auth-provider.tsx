/**
 * Firebase authentication provider and WCL bridge actions.
 */
import type { IdTokenResult, User } from 'firebase/auth'
import {
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
} from 'firebase/auth'
import {
  type FC,
  type PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import { defaultApiBaseUrl } from '../lib/constants'
import { getFirebaseAuth, isFirebaseAuthEnabled } from '../lib/firebase'
import {
  type WclAuthPopupResult,
  clearWclAuthPopupResult,
  parseWclAuthPopupResult,
  parseWclAuthPopupResultMessage,
  wclAuthPopupResultStorageKey,
} from './wcl-popup-bridge'

interface FirebaseCustomTokenResponse {
  customToken: string
}

interface WclIdentityClaims {
  wclUserId: string | null
  wclUserName: string | null
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
  wclUserId: string | null
  wclUserName: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)
const popupWidthPx = 520
const popupHeightPx = 760
const popupPollIntervalMs = 250
const popupClosedCoopProbeMs = 2000
const popupClosedResultGraceMs = 5000
const popupResultStaleToleranceMs = 30 * 1000
const popupTimeoutMs = 3 * 60 * 1000

function readStringClaim(
  claims: IdTokenResult['claims'],
  claimName: string,
): string | null {
  const value = claims[claimName]
  return typeof value === 'string' ? value : null
}

function parseWclIdentityClaims(tokenResult: IdTokenResult): WclIdentityClaims {
  return {
    wclUserId: readStringClaim(tokenResult.claims, 'wclUserId'),
    wclUserName: readStringClaim(tokenResult.claims, 'wclUserName'),
  }
}

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

function readPopupClosedState(popupWindow: Window): boolean {
  try {
    return popupWindow.closed
  } catch {
    return false
  }
}

function waitForWclPopupResult(
  popupWindow: Window,
  flowStartMs: number,
): Promise<WclAuthPopupResult> {
  return new Promise((resolve, reject) => {
    let intervalId = 0
    let timeoutId = 0
    let popupClosedAtMs: number | null = null
    let isPopupClosedStateUnreliable = false
    let completed = false

    function complete(callback: () => void): void {
      if (completed) {
        return
      }

      completed = true
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('message', onMessage)
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
      callback()
    }

    function maybeResolveResult(
      parsedResult: WclAuthPopupResult | null,
      options?: {
        ignoreFlowStart?: boolean
      },
    ): boolean {
      const ignoreFlowStart = options?.ignoreFlowStart ?? false
      if (!parsedResult) {
        return false
      }

      const isResultTooOldForFlow =
        parsedResult.createdAtMs < flowStartMs - popupResultStaleToleranceMs
      if (!ignoreFlowStart && isResultTooOldForFlow) {
        return false
      }

      complete(() => {
        clearWclAuthPopupResult()
        resolve(parsedResult)
      })

      return true
    }

    function maybeResolveResultFromStorage(): boolean {
      return maybeResolveResult(
        parseWclAuthPopupResult(
          window.localStorage.getItem(wclAuthPopupResultStorageKey),
        ),
      )
    }

    function onStorage(event: StorageEvent): void {
      if (event.key !== wclAuthPopupResultStorageKey) {
        return
      }

      maybeResolveResult(parseWclAuthPopupResult(event.newValue))
    }

    function onMessage(event: MessageEvent): void {
      if (event.origin !== window.location.origin) {
        return
      }

      maybeResolveResult(parseWclAuthPopupResultMessage(event.data))
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('message', onMessage)

    if (maybeResolveResultFromStorage()) {
      return
    }

    intervalId = window.setInterval(() => {
      if (maybeResolveResultFromStorage()) {
        return
      }

      if (readPopupClosedState(popupWindow)) {
        const nowMs = Date.now()
        if (popupClosedAtMs === null) {
          popupClosedAtMs = nowMs
          if (nowMs - flowStartMs <= popupClosedCoopProbeMs) {
            // OAuth providers using COOP can sever the opener proxy, causing
            // popupWindow.closed to appear true while the popup is still open.
            isPopupClosedStateUnreliable = true
          }
          return
        }

        if (isPopupClosedStateUnreliable) {
          return
        }

        if (nowMs - popupClosedAtMs < popupClosedResultGraceMs) {
          return
        }

        if (maybeResolveResultFromStorage()) {
          return
        }

        if (
          maybeResolveResult(
            parseWclAuthPopupResult(
              window.localStorage.getItem(wclAuthPopupResultStorageKey),
            ),
            {
              ignoreFlowStart: true,
            },
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
  const loginInFlightRef = useRef(false)
  const anonymousSignInInFlightRef = useRef(false)
  const [user, setUser] = useState<User | null>(null)
  const [wclUserId, setWclUserId] = useState<string | null>(null)
  const [wclUserName, setWclUserName] = useState<string | null>(null)
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

  useEffect(() => {
    if (!authEnabled || !auth || isInitializing || user) {
      return
    }
    if (anonymousSignInInFlightRef.current) {
      return
    }

    anonymousSignInInFlightRef.current = true
    void signInAnonymously(auth)
      .catch((error: unknown) => {
        const nextMessage =
          error instanceof Error
            ? error.message
            : 'Unable to initialize anonymous session.'
        setAuthError(nextMessage)
      })
      .finally(() => {
        anonymousSignInInFlightRef.current = false
      })
  }, [auth, authEnabled, isInitializing, user])

  useEffect(() => {
    if (!user) {
      setWclUserId(null)
      setWclUserName(null)
      return
    }

    let isCancelled = false

    void user
      .getIdTokenResult()
      .then((tokenResult) => {
        if (isCancelled) {
          return
        }

        const identity = parseWclIdentityClaims(tokenResult)
        setWclUserId(identity.wclUserId)
        setWclUserName(identity.wclUserName)
      })
      .catch(() => {
        if (isCancelled) {
          return
        }

        setWclUserId(null)
        setWclUserName(null)
      })

    return () => {
      isCancelled = true
    }
  }, [user])

  const exchangeBridgeCodeForCustomToken = async (
    bridgeCode: string,
  ): Promise<void> => {
    if (!authEnabled || !auth) {
      throw new Error('Firebase auth is not configured')
    }
    const idToken = auth.currentUser
      ? await auth.currentUser.getIdToken()
      : null
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    if (idToken) {
      headers.set('Authorization', `Bearer ${idToken}`)
    }

    const response = await fetch(
      `${defaultApiBaseUrl}/auth/firebase-custom-token`,
      {
        body: JSON.stringify({
          bridgeCode,
        }),
        headers,
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
    if (!authEnabled || isBusy || loginInFlightRef.current) {
      return
    }

    loginInFlightRef.current = true
    setAuthError(null)
    setIsBusy(true)

    const loginUrl = new URL('/auth/wcl/login', defaultApiBaseUrl)
    loginUrl.searchParams.set('origin', window.location.origin)
    const flowStartMs = Date.now()
    clearWclAuthPopupResult()
    const popupWindow = openWclLoginPopup(loginUrl.toString())
    if (!popupWindow) {
      setAuthError(
        'Unable to open the sign-in window. Disable popup blocking and try again.',
      )
      setIsBusy(false)
      loginInFlightRef.current = false
      return
    }

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
        loginInFlightRef.current = false
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
    wclUserId,
    wclUserName,
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
