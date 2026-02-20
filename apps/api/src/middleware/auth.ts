/**
 * Authentication Middleware
 *
 * Validates Firebase ID tokens from Authorization headers.
 */
import type { MiddlewareHandler } from 'hono'

import { verifyFirebaseIdToken } from '../services/firebase-auth'
import type { Bindings, Variables } from '../types/bindings'
import { unauthorized } from './error'

/**
 * Validate a Firebase ID token and attach uid to request context.
 */
export const authMiddleware: MiddlewareHandler<{
  Bindings: Bindings
  Variables: Variables
}> = async (c, next) => {
  const authHeader = c.req.header('authorization')

  if (c.env.ENVIRONMENT === 'test' && !authHeader) {
    c.set('uid', 'wcl-test-user')
    await next()
    return
  }

  if (!authHeader) {
    throw unauthorized('Missing Authorization header')
  }

  // Expect format: "Bearer <firebase_id_token>"
  const [scheme, token] = authHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    throw unauthorized('Invalid Authorization header format')
  }

  const verifiedToken = await verifyFirebaseIdToken(token, c.env)
  c.set('uid', verifiedToken.uid)

  await next()
}
