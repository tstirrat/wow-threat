/**
 * PostHog SDK configuration and helpers.
 */
import type { PostHogConfig } from 'posthog-js'

export const posthogApiKey: string = import.meta.env.VITE_POSTHOG_KEY ?? ''

export const posthogOptions: Partial<PostHogConfig> = {
  api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
  autocapture: false,
  capture_pageview: false,
  persistence: 'localStorage',
  person_profiles: 'identified_only',
  disable_session_recording: true,
}

export function isPostHogEnabled(): boolean {
  return posthogApiKey.length > 0
}
