/**
 * WCL Threat Augmentation API
 *
 * Entry point for the Cloudflare Workers application.
 */
import { withSentry } from '@sentry/cloudflare'
import { generateRequestId } from '@wow-threat/shared'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { secureHeaders } from 'hono/secure-headers'
import { timing } from 'hono/timing'

import { authMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error'
import { authRoutes } from './routes/auth'
import { healthRoutes } from './routes/health'
import { reportRoutes } from './routes/reports'
import { isOriginAllowed, parseAllowedOrigins } from './services/origins'
import { validateRuntimeConfig } from './services/runtime-config'
import type { Bindings, Variables } from './types/bindings'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Request ID middleware
app.use('*', async (c, next) => {
  c.set('requestId', generateRequestId())
  c.set('startTime', Date.now())
  await next()
})

// Runtime configuration validation (non-test environments)
app.use('*', async (c, next) => {
  await validateRuntimeConfig(c.env)
  await next()
})

// Structured access logging
app.use('*', async (c, next) => {
  await next()

  console.info(
    JSON.stringify({
      durationMs: Date.now() - c.get('startTime'),
      method: c.req.method,
      path: c.req.path,
      requestId: c.get('requestId'),
      status: c.res.status,
      uid: c.get('uid') ?? null,
    }),
  )
})

// Global middleware
app.use('*', timing())
app.use('*', secureHeaders())
app.use(
  '*',
  cors({
    origin: (requestOrigin, c) => {
      const allowedOrigins = parseAllowedOrigins(c.env.ALLOWED_ORIGINS)
      if (!requestOrigin) {
        return allowedOrigins[0] ?? ''
      }

      return isOriginAllowed(requestOrigin, allowedOrigins)
        ? requestOrigin
        : (allowedOrigins[0] ?? '')
    },
    credentials: true,
  }),
)
app.use('*', prettyJSON())
app.use('*', logger())

// Error handling
app.onError(errorHandler)

// Health check (no auth)
app.route('/health', healthRoutes)

// Authentication routes (no /v1 auth middleware)
app.route('/auth', authRoutes)

// API routes (with auth)
const api = new Hono<{ Bindings: Bindings; Variables: Variables }>()
api.use('*', authMiddleware)
api.route('/reports', reportRoutes)

app.route('/v1', api)

// 404 handler
app.notFound((c) =>
  c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${c.req.method} ${c.req.path}`,
      },
      requestId: c.get('requestId'),
    },
    404,
  ),
)

export { app }

export default withSentry<Bindings>(
  (env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.1 : 1.0,
    environment: env.ENVIRONMENT,
  }),
  app,
)
