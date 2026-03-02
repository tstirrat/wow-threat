/**
 * Minimal fetch client for API requests.
 */
import { type Auth, signInAnonymously } from 'firebase/auth'

import { getFirebaseAuth } from '../lib/firebase'

export class ApiClientError extends Error {
  public readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

let inFlightAnonymousSignIn: Promise<string | null> | null = null

async function getFirebaseIdToken(auth: Auth): Promise<string | null> {
  if (auth.currentUser) {
    return auth.currentUser.getIdToken()
  }

  if (!inFlightAnonymousSignIn) {
    inFlightAnonymousSignIn = signInAnonymously(auth)
      .then((credential) => credential.user.getIdToken())
      .catch(() => null)
      .finally(() => {
        inFlightAnonymousSignIn = null
      })
  }

  return inFlightAnonymousSignIn
}

/** Execute a JSON request and return parsed data. */
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const auth = getFirebaseAuth()
  const idToken = auth ? await getFirebaseIdToken(auth) : null
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (idToken) {
    headers.set('Authorization', `Bearer ${idToken}`)
  }

  const response = await fetch(url, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const body = await response.text()
    let message = body || `Request failed with status ${response.status}`

    if (body) {
      try {
        const parsed = JSON.parse(body) as {
          error?: {
            message?: unknown
          }
        }
        if (typeof parsed.error?.message === 'string') {
          message = parsed.error.message
        }
      } catch {
        // Keep raw body when the response is not valid JSON.
      }
    }

    throw new ApiClientError(message, response.status)
  }

  return (await response.json()) as T
}
