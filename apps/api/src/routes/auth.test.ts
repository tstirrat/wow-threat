/**
 * Integration tests for auth routes and bridge code behavior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockBindings } from '../../test/setup'
import app from '../index'

interface FirestoreDocument {
  fields: Record<string, unknown>
  updateTime: string
}

const firestorePrefix =
  'https://firestore.googleapis.com/v1/projects/wow-threat/databases/(default)/documents/'

function createAuthFetchMock() {
  const documents = new Map<string, FirestoreDocument>()

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === 'string' ? input : input.toString()
    const url = new URL(requestUrl)

    if (url.toString().includes('warcraftlogs.com/oauth/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'wcl-access-token',
          expires_in: 3600,
          refresh_token: 'wcl-refresh-token',
          token_type: 'Bearer',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    if (url.toString().includes('warcraftlogs.com/api/v2/user')) {
      return new Response(
        JSON.stringify({
          id: 12345,
          name: 'TestWclUser',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    if (url.toString().startsWith(firestorePrefix)) {
      const relativePath = decodeURIComponent(
        url.toString().slice(firestorePrefix.length).split('?')[0] ?? '',
      )
      const searchParams = new URLSearchParams(url.search)
      const updateMask = searchParams.getAll('updateMask.fieldPaths')
      const currentUpdateTime = searchParams.get('currentDocument.updateTime')
      const document = documents.get(relativePath)
      const method = init?.method ?? 'GET'

      if (method === 'GET') {
        if (!document) {
          return new Response(
            JSON.stringify({
              error: {
                message: 'Document not found',
              },
            }),
            {
              status: 404,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
        }

        return new Response(
          JSON.stringify({
            fields: document.fields,
            updateTime: document.updateTime,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      }

      if (method === 'DELETE') {
        if (!document) {
          return new Response(
            JSON.stringify({
              error: {
                message: 'Document not found',
              },
            }),
            {
              status: 404,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
        }

        documents.delete(relativePath)
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }

      if (method === 'PATCH') {
        if (
          currentUpdateTime &&
          (!document || document.updateTime !== currentUpdateTime)
        ) {
          return new Response(
            JSON.stringify({
              error: {
                message: 'Precondition failed',
              },
            }),
            {
              status: 412,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
        }

        const body = init?.body
          ? (JSON.parse(init.body as string) as {
              fields?: Record<string, unknown>
            })
          : { fields: {} }
        const nextFields: Record<string, unknown> = {
          ...(document?.fields ?? {}),
        }

        if (updateMask.length > 0) {
          updateMask.forEach((fieldPath) => {
            if (body.fields && fieldPath in body.fields) {
              nextFields[fieldPath] = body.fields[fieldPath]
            }
          })
        } else {
          Object.assign(nextFields, body.fields ?? {})
        }

        const updateTime = new Date(Date.now()).toISOString()
        documents.set(relativePath, {
          fields: nextFields,
          updateTime,
        })

        return new Response(
          JSON.stringify({
            fields: nextFields,
            updateTime,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      }
    }

    throw new Error(`Unexpected fetch request in auth tests: ${requestUrl}`)
  })
}

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', createAuthFetchMock())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirects to wcl oauth login with signed state', async () => {
    const res = await app.request(
      'http://localhost/auth/wcl/login?origin=http://localhost:5173',
      {},
      createMockBindings(),
    )

    expect(res.status).toBe(302)
    const location = res.headers.get('Location')
    expect(location).toBeTruthy()
    expect(location).toContain('https://www.warcraftlogs.com/oauth/authorize')
    expect(location).toContain('state=')
  })

  it('rejects callback requests with invalid oauth state', async () => {
    const res = await app.request(
      'http://localhost/auth/wcl/callback?code=abc123&state=invalid-state',
      {},
      createMockBindings(),
    )

    expect(res.status).toBe(401)
  })

  it('exchanges bridge code once and rejects reuse', async () => {
    const bindings = createMockBindings()

    const loginRes = await app.request(
      'http://localhost/auth/wcl/login?origin=http://localhost:5173',
      {},
      bindings,
    )
    const loginLocation = new URL(loginRes.headers.get('Location')!)
    const state = loginLocation.searchParams.get('state')

    expect(state).toBeTruthy()

    const callbackRes = await app.request(
      `http://localhost/auth/wcl/callback?code=oauth-code-123&state=${encodeURIComponent(state!)}`,
      {},
      bindings,
    )
    expect(callbackRes.status).toBe(302)

    const callbackLocation = new URL(callbackRes.headers.get('Location')!)
    expect(callbackLocation.pathname).toBe('/auth/complete')
    const callbackHash = callbackLocation.hash.startsWith('#')
      ? callbackLocation.hash.slice(1)
      : callbackLocation.hash
    const bridgeCode = new URLSearchParams(callbackHash).get('bridge')
    expect(bridgeCode).toBeTruthy()

    const exchangeRes = await app.request(
      'http://localhost/auth/firebase-custom-token',
      {
        body: JSON.stringify({
          bridgeCode,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      bindings,
    )
    expect(exchangeRes.status).toBe(200)

    const exchangeBody = (await exchangeRes.json()) as {
      customToken: string
    }
    expect(exchangeBody.customToken).toBe('test-custom-token:wcl:12345')

    const reuseRes = await app.request(
      'http://localhost/auth/firebase-custom-token',
      {
        body: JSON.stringify({
          bridgeCode,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      bindings,
    )
    expect(reuseRes.status).toBe(401)
  })
})
