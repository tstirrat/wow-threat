/**
 * Tests for theme class application and canvas theme-change notifications.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider, useTheme } from './theme-provider'

function LightThemeButton() {
  const { setTheme } = useTheme()
  return (
    <button type="button" onClick={() => setTheme('light')}>
      Light
    </button>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string): string | null => values.get(key) ?? null,
      setItem: (key: string, value: string): void => {
        values.set(key, value)
      },
    })
    document.documentElement.classList.remove('light', 'dark')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('applies the theme class and color scheme to the document root', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <LightThemeButton />
      </ThemeProvider>,
    )

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('dispatches themechange after switching theme so canvas colors refresh', () => {
    const listener = vi.fn(() =>
      document.documentElement.classList.contains('light'),
    )
    window.addEventListener('themechange', listener)

    render(
      <ThemeProvider defaultTheme="dark">
        <LightThemeButton />
      </ThemeProvider>,
    )
    listener.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Light' }))

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveReturnedWith(true)
    window.removeEventListener('themechange', listener)
  })
})
