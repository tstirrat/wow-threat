/**
 * Fires PostHog $pageview events on route changes.
 * No-ops gracefully when PostHog is not initialized.
 */
import { usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function usePageViewTracking(): void {
  const posthog = usePostHog()
  const location = useLocation()

  useEffect(() => {
    if (!posthog) return
    posthog.capture('$pageview', { path: location.pathname })
  }, [posthog, location.pathname])
}
