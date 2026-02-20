/**
 * Minimal fetch client for API requests.
 */
import { signOut as firebaseSignOut } from 'firebase/auth'

import { getFirebaseAuth } from '../lib/firebase'

export class ApiClientError extends Error {
  public readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Execute a JSON request and return parsed data. */
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const auth = getFirebaseAuth()
  const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null
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
    if (response.status === 401 && auth?.currentUser) {
      await firebaseSignOut(auth)
    }

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
