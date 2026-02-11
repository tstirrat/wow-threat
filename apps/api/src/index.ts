/**
 * WCL Threat Augmentation API
 *
 * Entry point for the Cloudflare Workers application.
 */
import { generateRequestId } from '@wcl-threat/shared'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { secureHeaders } from 'hono/secure-headers'
import { timing } from 'hono/timing'

import { authMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error'
import { reportRoutes } from './routes/reports'
import type { Bindings, Variables } from './types/bindings'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Request ID middleware
app.use('*', async (c, next) => {
  c.set('requestId', generateRequestId())
  c.set('startTime', Date.now())
  await next()
})

// Global middleware
app.use('*', timing())
app.use('*', secureHeaders())
app.use(
  '*',
  cors({
    origin: [
      'https://wcl-threat.dev',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
  }),
)
app.use('*', prettyJSON())
app.use('*', logger())

// Error handling
app.onError(errorHandler)

// Health check (no auth)
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    environment: c.env.ENVIRONMENT,
    requestId: c.get('requestId'),
  }),
)

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

export default app
