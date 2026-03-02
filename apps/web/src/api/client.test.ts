/**
 * Tests for API client auth header behavior.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requestJson } from './client'

const getFirebaseAuthMock = vi.fn()
const signInAnonymouslyMock = vi.fn()

vi.mock('../lib/firebase', () => ({
  getFirebaseAuth: () => getFirebaseAuthMock(),
}))

vi.mock('firebase/auth', () => ({
  signInAnonymously: (...args: unknown[]) => signInAnonymouslyMock(...args),
}))

describe('requestJson', () => {
  beforeEach(() => {
    getFirebaseAuthMock.mockReset()
    signInAnonymouslyMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('uses firebase bearer auth when a user session exists', async () => {
    getFirebaseAuthMock.mockReturnValue({
      currentUser: {
        getIdToken: vi.fn(async () => 'firebase-id-token'),
      },
    })

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await requestJson<{ ok: boolean }>(
      'http://localhost:8788/v1/reports/ABC123',
    )

    expect(response.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(signInAnonymouslyMock).not.toHaveBeenCalled()

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    const requestHeaders = new Headers(requestInit?.headers)
    expect(requestHeaders.get('Authorization')).toBe('Bearer firebase-id-token')
  })

  it('signs in anonymously and attaches bearer token when no user session exists', async () => {
    const anonymousGetIdToken = vi.fn(async () => 'anonymous-id-token')
    const auth = {
      currentUser: null,
    }
    getFirebaseAuthMock.mockReturnValue(auth)
    signInAnonymouslyMock.mockImplementation(async () => {
      auth.currentUser = {
        getIdToken: anonymousGetIdToken,
      }
      return {
        user: auth.currentUser,
      }
    })

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await requestJson<{ ok: boolean }>(
      'http://localhost:8788/v1/reports/ABC123',
    )

    expect(response.ok).toBe(true)
    expect(signInAnonymouslyMock).toHaveBeenCalledTimes(1)
    expect(anonymousGetIdToken).toHaveBeenCalledTimes(1)
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    const requestHeaders = new Headers(requestInit?.headers)
    expect(requestHeaders.get('Authorization')).toBe(
      'Bearer anonymous-id-token',
    )
  })
})
