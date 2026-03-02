/**
 * Authentication Middleware
 *
 * Validates Firebase ID tokens and attaches auth context claims.
 */
import type { MiddlewareHandler } from 'hono'

import { verifyFirebaseIdToken } from '../services/firebase-auth'
import type { Bindings, Variables } from '../types/bindings'
import { unauthorized } from './error'

function readStringClaim(claim: unknown): string | null {
  return typeof claim === 'string' && claim.trim().length > 0 ? claim : null
}

/**
 * Validate Firebase auth and attach uid/wcl claims to request context.
 */
export const authMiddleware: MiddlewareHandler<{
  Bindings: Bindings
  Variables: Variables
}> = async (c, next) => {
  const authHeader = c.req.header('authorization')

  if (c.env.ENVIRONMENT === 'test' && !authHeader) {
    c.set('uid', 'wcl-test-user')
    c.set('wclUserId', '12345')
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
  const wclUserId = readStringClaim(verifiedToken.claims.wclUserId)
  if (wclUserId) {
    c.set('wclUserId', wclUserId)
  }

  await next()
}
