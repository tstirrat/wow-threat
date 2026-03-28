/**
 * Tests for usePageViewTracking hook.
 */
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePageViewTracking } from './use-page-view-tracking'

const mockCapture = vi.fn()
const mockPosthog = { capture: mockCapture }

vi.mock('posthog-js/react', () => ({
  usePostHog: vi.fn(),
}))

async function getUsePostHog() {
  const mod = await import('posthog-js/react')
  return vi.mocked(mod.usePostHog)
}

function renderWithRouter(initialPath = '/') {
  return renderHook(() => usePageViewTracking(), {
    wrapper: ({ children }) =>
      MemoryRouter({ children, initialEntries: [initialPath] }) as JSX.Element,
  })
}

describe('usePageViewTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('captures $pageview with the current pathname on mount', async () => {
    const usePostHog = await getUsePostHog()
    usePostHog.mockReturnValue(mockPosthog as ReturnType<typeof usePostHog>)

    renderWithRouter('/report/abc123')

    expect(mockCapture).toHaveBeenCalledOnce()
    expect(mockCapture).toHaveBeenCalledWith('$pageview', {
      path: '/report/abc123',
    })
  })

  it('does not capture when posthog is not initialized', async () => {
    const usePostHog = await getUsePostHog()
    usePostHog.mockReturnValue(null as ReturnType<typeof usePostHog>)

    renderWithRouter('/')

    expect(mockCapture).not.toHaveBeenCalled()
  })

  it('does not re-capture on re-render when pathname has not changed', async () => {
    const usePostHog = await getUsePostHog()
    usePostHog.mockReturnValue(mockPosthog as ReturnType<typeof usePostHog>)

    const { rerender } = renderWithRouter('/')

    expect(mockCapture).toHaveBeenCalledOnce()
    mockCapture.mockClear()

    rerender()
    expect(mockCapture).not.toHaveBeenCalled()
  })
})
