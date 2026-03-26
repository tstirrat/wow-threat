/**
 * Health check route.
 *
 * Returns structured dependency status for KV, Firestore, and WCL API.
 * 200 for healthy or partially degraded; 503 only when all deps are down.
 */
import { Hono } from 'hono'

import { runHealthChecks } from '../services/health-check'
import type { Bindings, Variables } from '../types/bindings'

export const healthRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

healthRoutes.get('/', async (c) => {
  const result = await runHealthChecks(c.env)
  const httpStatus = result.status === 'error' ? 503 : 200
  return c.json(
    {
      ...result,
      environment: c.env.ENVIRONMENT,
      requestId: c.get('requestId'),
    },
    httpStatus,
  )
})
