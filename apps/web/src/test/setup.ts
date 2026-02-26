/**
 * Vitest setup for React Testing Library matchers.
 */
import '@testing-library/jest-dom/vitest'

class ResizeObserverMock {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver
}
