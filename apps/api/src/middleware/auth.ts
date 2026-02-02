/**
 * Authentication Middleware
 *
 * Validates API key from Authorization header.
 */

import type { MiddlewareHandler } from 'hono'
import type { Bindings, Variables } from '../types/bindings'
import { unauthorized } from './error'

/**
 * Simple API key authentication
 * In production, this should validate against a database or external service
 */
export const authMiddleware: MiddlewareHandler<{
  Bindings: Bindings
  Variables: Variables
}> = async (c, next) => {
  // Skip auth in development/test
  if (c.env.ENVIRONMENT === 'development' || c.env.ENVIRONMENT === 'test') {
    await next()
    return
  }

  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    throw unauthorized('Missing Authorization header')
  }

  // Expect format: "Bearer <api_key>"
  const [scheme, token] = authHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    throw unauthorized('Invalid Authorization header format. Expected: Bearer <api_key>')
  }

  // TODO: Validate the token against your authentication system
  // For now, just check it's not empty
  if (!token.trim()) {
    throw unauthorized('Invalid API key')
  }

  await next()
}
