/**
 * Tests for player info drawer persistence and the I hotkey.
 */
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HotkeysProvider } from 'react-hotkeys-hook'
import { beforeEach, describe, expect, it } from 'vitest'

import { playerInfoClosedStorageKey } from '../lib/constants'
import { usePlayerInfoDrawer } from './use-player-info-drawer'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HotkeysProvider initiallyActiveScopes={['fight-page']}>
    {children}
  </HotkeysProvider>
)

const Probe = () => {
  const { isPlayerInfoOpen } = usePlayerInfoDrawer()
  return <p>{isPlayerInfoOpen ? 'open' : 'closed'}</p>
}

describe('usePlayerInfoDrawer', () => {
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

  it('defaults to open', () => {
    const { result } = renderHook(() => usePlayerInfoDrawer(), { wrapper })
    expect(result.current.isPlayerInfoOpen).toBe(true)
  })

  it('persists the closed state and restores it on mount', () => {
    const { result, unmount } = renderHook(() => usePlayerInfoDrawer(), {
      wrapper,
    })
    act(() => result.current.togglePlayerInfo())
    expect(result.current.isPlayerInfoOpen).toBe(false)
    expect(window.localStorage.getItem(playerInfoClosedStorageKey)).toBe('true')
    unmount()

    const remounted = renderHook(() => usePlayerInfoDrawer(), { wrapper })
    expect(remounted.result.current.isPlayerInfoOpen).toBe(false)
  })

  it('toggles with the i key and ignores modified presses', async () => {
    const user = userEvent.setup()
    render(<Probe />, { wrapper })
    expect(screen.getByText('open')).toBeInTheDocument()

    await user.keyboard('{Control>}i{/Control}')
    await user.keyboard('{Shift>}i{/Shift}')
    expect(screen.getByText('open')).toBeInTheDocument()

    await user.keyboard('i')
    expect(screen.getByText('closed')).toBeInTheDocument()
    await user.keyboard('i')
    expect(screen.getByText('open')).toBeInTheDocument()
  })
})

describe('usePlayerInfoDrawer height', () => {
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

  it('defaults to no saved height and persists a resized height', () => {
    const { result, unmount } = renderHook(() => usePlayerInfoDrawer(), {
      wrapper,
    })
    expect(result.current.playerInfoHeight).toBeNull()
    act(() => result.current.setPlayerInfoHeight(300))
    expect(result.current.playerInfoHeight).toBe(300)
    unmount()

    const { result: restored } = renderHook(() => usePlayerInfoDrawer(), {
      wrapper,
    })
    expect(restored.current.playerInfoHeight).toBe(300)
  })
})
