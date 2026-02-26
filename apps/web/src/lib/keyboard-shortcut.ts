/**
 * Platform-aware keyboard shortcut label helpers.
 */

/** Returns the primary modifier key label for app shortcuts. */
export function superKey(): string {
  if (typeof navigator === 'undefined') {
    return 'Ctrl'
  }

  const navigatorWithUAData = navigator as Navigator & {
    userAgentData?: {
      platform?: string
    }
  }
  const platform =
    navigatorWithUAData.userAgentData?.platform ?? navigator.platform
  return /mac/i.test(platform) ? '⌘' : 'Ctrl'
}
