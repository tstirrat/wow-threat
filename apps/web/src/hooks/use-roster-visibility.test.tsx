/**
 * Tests for roster visibility persistence and the R hotkey.
 */
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HotkeysProvider } from 'react-hotkeys-hook'
import { beforeEach, describe, expect, it } from 'vitest'

import { rosterHiddenStorageKey } from '../lib/constants'
import { useRosterVisibility } from './use-roster-visibility'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HotkeysProvider initiallyActiveScopes={['fight-page']}>
    {children}
  </HotkeysProvider>
)

const Probe = () => {
  const { isRosterVisible } = useRosterVisibility()
  return <p>{isRosterVisible ? 'visible' : 'hidden'}</p>
}

describe('useRosterVisibility', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string): string | null => values.get(key) ?? null,
        setItem: (key: string, value: string): void => {
          values.set(key, value)
        },
      },
    })
  })

  it('defaults to visible', () => {
    const { result } = renderHook(() => useRosterVisibility(), { wrapper })
    expect(result.current.isRosterVisible).toBe(true)
  })

  it('persists the hidden state and restores it on mount', () => {
    const { result, unmount } = renderHook(() => useRosterVisibility(), {
      wrapper,
    })
    act(() => result.current.toggleRoster())
    expect(result.current.isRosterVisible).toBe(false)
    expect(window.localStorage.getItem(rosterHiddenStorageKey)).toBe('true')
    unmount()

    const remounted = renderHook(() => useRosterVisibility(), { wrapper })
    expect(remounted.result.current.isRosterVisible).toBe(false)
  })

  it('toggles with the r key and ignores modified presses', async () => {
    const user = userEvent.setup()
    render(<Probe />, { wrapper })
    expect(screen.getByText('visible')).toBeInTheDocument()

    await user.keyboard('{Control>}r{/Control}')
    expect(screen.getByText('visible')).toBeInTheDocument()

    await user.keyboard('r')
    expect(screen.getByText('hidden')).toBeInTheDocument()
    await user.keyboard('r')
    expect(screen.getByText('visible')).toBeInTheDocument()
  })
})
