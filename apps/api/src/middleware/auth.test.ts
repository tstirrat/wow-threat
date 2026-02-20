/**
 * Tests for Firebase auth middleware behavior.
 */
import type { Bindings, Variables } from '@/types/bindings'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { createMockBindings } from '../../test/setup'
import { authMiddleware } from './auth'
import { errorHandler } from './error'

const authTestApp = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

authTestApp.onError(errorHandler)
authTestApp.use('/secure/*', authMiddleware)
authTestApp.get('/secure/resource', (c) =>
  c.json({
    uid: c.get('uid') ?? null,
  }),
)

describe('authMiddleware', () => {
  it('returns 401 when authorization header is missing', async () => {
    const res = await authTestApp.request(
      'http://localhost/secure/resource',
      {},
      {
        ...createMockBindings(),
        ENVIRONMENT: 'production' as const,
      },
    )

    expect(res.status).toBe(401)
  })

  it('returns 401 when firebase id token is invalid', async () => {
    const res = await authTestApp.request(
      'http://localhost/secure/resource',
      {
        headers: {
          Authorization: 'Bearer not-a-valid-test-token',
        },
      },
      createMockBindings(),
    )

    expect(res.status).toBe(401)
  })

  it('returns 401 when firebase id token is expired', async () => {
    const res = await authTestApp.request(
      'http://localhost/secure/resource',
      {
        headers: {
          Authorization: 'Bearer test-firebase-id-token:test-user:expired',
        },
      },
      createMockBindings(),
    )

    expect(res.status).toBe(401)
  })

  it('allows requests with valid firebase id token', async () => {
    const res = await authTestApp.request(
      'http://localhost/secure/resource',
      {
        headers: {
          Authorization: 'Bearer test-firebase-id-token:test-user',
        },
      },
      createMockBindings(),
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as { uid: string }
    expect(data.uid).toBe('test-user')
  })
})
