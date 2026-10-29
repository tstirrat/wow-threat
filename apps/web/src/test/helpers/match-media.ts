/**
 * Test helper that stubs window.matchMedia so mobile-layout hooks can be exercised in jsdom.
 */
/** Stub matchMedia so every query reports `matches`; returns a restore function. */
export function stubMatchMedia(matches: boolean): () => void {
  const original = window.matchMedia
  window.matchMedia = (query: string): MediaQueryList => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })
  return () => {
    window.matchMedia = original
  }
}
