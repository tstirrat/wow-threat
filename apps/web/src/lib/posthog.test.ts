/**
 * Tests for PostHog configuration module.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { groupPathnameBeforeSend, normalizePathname } from './posthog'

describe('isPostHogEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('returns false when VITE_POSTHOG_KEY is not set', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '')
    vi.resetModules()

    const { isPostHogEnabled } = await import('./posthog')

    expect(isPostHogEnabled()).toBe(false)
  })

  it('returns false when VITE_POSTHOG_KEY is undefined', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', undefined)
    vi.resetModules()

    const { isPostHogEnabled } = await import('./posthog')

    expect(isPostHogEnabled()).toBe(false)
  })

  it('returns false when VITE_POSTHOG_KEY is set but MODE is not production', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key')
    vi.stubEnv('MODE', 'development')
    vi.resetModules()

    const { isPostHogEnabled } = await import('./posthog')

    expect(isPostHogEnabled()).toBe(false)
  })

  it('returns true when VITE_POSTHOG_KEY is set and MODE is production', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key')
    vi.stubEnv('MODE', 'production')
    vi.resetModules()

    const { isPostHogEnabled } = await import('./posthog')

    expect(isPostHogEnabled()).toBe(true)
  })
})

describe('posthogOptions', () => {
  it('disables automatic pageview capture', async () => {
    const { posthogOptions } = await import('./posthog')

    expect(posthogOptions.capture_pageview).toBe(false)
  })

  it('disables autocapture', async () => {
    const { posthogOptions } = await import('./posthog')

    expect(posthogOptions.autocapture).toBe(false)
  })

  it('disables session recording', async () => {
    const { posthogOptions } = await import('./posthog')

    expect(posthogOptions.disable_session_recording).toBe(true)
  })

  it('restricts person profiles to identified-only to avoid anonymous profile creation', async () => {
    const { posthogOptions } = await import('./posthog')

    expect(posthogOptions.person_profiles).toBe('identified_only')
  })
})

describe('normalizePathname', () => {
  it.each([
    ['/report/MvrY6aBgftZxj1QX/fight/1', '/report/:reportId/fight/:fightId'],
    ['/report/MvrY6aBgftZxj1QX', '/report/:reportId'],
    ['/report/MvrY6aBgftZxj1QX/', '/report/:reportId'],
    ['/reports/guild/123', '/reports/:entityType/:entityId'],
    ['/', '/'],
    ['/auth/complete', '/auth/complete'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizePathname(input)).toBe(expected)
  })
})

describe('groupPathnameBeforeSend', () => {
  it('replaces $pathname with the route template and keeps the raw path', () => {
    const event = {
      uuid: 'id',
      event: '$pageview',
      properties: { $pathname: '/report/abc/fight/2', other: 1 },
    }

    expect(groupPathnameBeforeSend(event)?.properties).toEqual({
      $pathname: '/report/:reportId/fight/:fightId',
      raw_pathname: '/report/abc/fight/2',
      other: 1,
    })
  })

  it('passes events without a $pathname through unchanged', () => {
    const event = { uuid: 'id', event: 'custom', properties: { a: 1 } }

    expect(groupPathnameBeforeSend(event)).toEqual(event)
  })

  it('passes null through', () => {
    expect(groupPathnameBeforeSend(null)).toBeNull()
  })
})
