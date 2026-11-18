/**
 * PostHog SDK configuration and helpers.
 */
import type { CaptureResult, PostHogConfig } from 'posthog-js'

export const posthogApiKey: string = import.meta.env.VITE_POSTHOG_KEY ?? ''

const ROUTE_TEMPLATES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/report\/[^/]+\/fight\/[^/]+\/?$/, '/report/:reportId/fight/:fightId'],
  [/^\/report\/[^/]+\/?$/, '/report/:reportId'],
  [/^\/reports\/[^/]+\/[^/]+\/?$/, '/reports/:entityType/:entityId'],
]

/** Collapses a concrete pathname into its route template (unknown paths pass through). */
export function normalizePathname(pathname: string): string {
  const match = ROUTE_TEMPLATES.find(([pattern]) => pattern.test(pathname))
  return match ? match[1] : pathname
}

/** Groups $pathname by route template, keeping the original in raw_pathname. */
export function groupPathnameBeforeSend(
  event: CaptureResult | null,
): CaptureResult | null {
  const rawPathname = event?.properties?.$pathname
  if (!event?.properties || typeof rawPathname !== 'string') {
    return event
  }

  return {
    ...event,
    properties: {
      ...event.properties,
      raw_pathname: rawPathname,
      $pathname: normalizePathname(rawPathname),
    },
  }
}

export const posthogOptions: Partial<PostHogConfig> = {
  api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
  autocapture: false,
  capture_pageview: false,
  persistence: 'localStorage',
  person_profiles: 'identified_only',
  disable_session_recording: true,
  before_send: groupPathnameBeforeSend,
}

export function isPostHogEnabled(): boolean {
  return import.meta.env.MODE === 'production' && posthogApiKey.length > 0
}
