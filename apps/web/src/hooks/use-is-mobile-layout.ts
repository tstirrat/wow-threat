/**
 * Tracks whether the viewport is below the mobile layout breakpoint (760px).
 */
import { useSyncExternalStore } from 'react'

import { mobileLayoutMediaQuery } from '../lib/constants'

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return null
  }

  return window.matchMedia(mobileLayoutMediaQuery)
}

function subscribe(onChange: () => void): () => void {
  const mediaQueryList = getMediaQueryList()
  mediaQueryList?.addEventListener('change', onChange)
  return () => mediaQueryList?.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return getMediaQueryList()?.matches ?? false
}

/** Return true while the viewport uses the mobile layout (off-canvas rail/roster, chart tabs). */
export function useIsMobileLayout(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
