/**
 * Tests for Sentry initialization module.
 */
import { browserTracingIntegration, init } from '@sentry/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { initSentry } from './sentry'

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
}))

describe('initSentry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sets environment to staging for PR preview channels', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@o0.ingest.sentry.io/0')
    vi.stubGlobal('location', { hostname: 'pr-123--wow-threat.web.app', origin: window.location.origin })

    initSentry()

    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'staging',
      }),
    )
  })

  it('sets environment to production for non-PR hostnames', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@o0.ingest.sentry.io/0')
    vi.stubGlobal('location', { hostname: 'wow-threat.web.app', origin: window.location.origin })

    initSentry()

    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'production',
      }),
    )
  })

  it('calls init when VITE_SENTRY_DSN is set', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@o0.ingest.sentry.io/0')

    initSentry()

    expect(init).toHaveBeenCalledOnce()
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://public@o0.ingest.sentry.io/0',
        tracePropagationTargets: [window.location.origin],
      }),
    )
    expect(browserTracingIntegration).toHaveBeenCalledOnce()
  })

  it('does not call init when VITE_SENTRY_DSN is empty', () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')

    initSentry()

    expect(init).not.toHaveBeenCalled()
  })

  it('does not call init when VITE_SENTRY_DSN is undefined', () => {
    vi.stubEnv('VITE_SENTRY_DSN', undefined)

    initSentry()

    expect(init).not.toHaveBeenCalled()
  })
})
