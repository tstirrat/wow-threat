/**
 * Sentry Initialization
 *
 * Initializes Sentry error tracking for the web app. Called early in main.tsx
 * before React mounts. No-ops when VITE_SENTRY_DSN is not configured.
 */
import { browserTracingIntegration, init } from '@sentry/react'

/**
 * Determine runtime environment based on hostname.
 * PR preview channels are marked as 'staging', all others as 'production'.
 */
function getEnvironment(): 'staging' | 'production' {
  return window.location.hostname.includes('pr-') ? 'staging' : 'production'
}

/** Initialize Sentry if a DSN is configured. */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  init({
    dsn,
    environment: getEnvironment(),
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    tracePropagationTargets: [window.location.origin],
    integrations: [browserTracingIntegration()],
  })
}
