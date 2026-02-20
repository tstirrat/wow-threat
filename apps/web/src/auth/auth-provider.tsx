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

interface FirebaseCustomTokenResponse {
  customToken: string
}

export interface AuthContextValue {
  authEnabled: boolean
  completeBridgeSignIn: (bridgeCode: string) => Promise<void>
  isBusy: boolean
  isInitializing: boolean
  signOut: () => Promise<void>
  startWclLogin: () => void
  user: User | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

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

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const authEnabled = isFirebaseAuthEnabled
  const auth = getFirebaseAuth()
  const [user, setUser] = useState<User | null>(null)
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

  const startWclLogin = (): void => {
    if (!authEnabled) {
      return
    }

    const loginUrl = new URL('/auth/wcl/login', defaultApiBaseUrl)
    loginUrl.searchParams.set('origin', window.location.origin)
    window.location.assign(loginUrl.toString())
  }

  const completeBridgeSignIn = async (bridgeCode: string): Promise<void> => {
    if (!authEnabled || !auth) {
      throw new Error('Firebase auth is not configured')
    }

    setIsBusy(true)
    try {
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
      setIsBusy(false)
    }
  }

  const value: AuthContextValue = {
    authEnabled,
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
