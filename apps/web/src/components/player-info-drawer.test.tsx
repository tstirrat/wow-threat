/**
 * Tests for the player info drawer title bar and collapse behavior.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ShortcutsOverlayContext } from '../routes/app-shell-context'
import { stubMatchMedia } from '../test/helpers/match-media'
import type { FocusedPlayerSummary, InitialAuraDisplay } from '../types/app'
import { PlayerInfoDrawer } from './player-info-drawer'

const summary: FocusedPlayerSummary = {
  actorId: 1,
  label: 'Aegistank',
  actorClass: 'Warrior',
  talentPoints: undefined,
  totalThreat: 100,
  totalTps: 10,
  totalDamage: 50,
  totalHealing: 0,
  color: 'rgb(199, 156, 110)',
  modifiers: [],
}
const auras: InitialAuraDisplay[] = [
  { spellId: 25780, name: 'Righteous Fury', stacks: 1, isNotable: true },
  { spellId: 1126, name: 'Mark of the Wild', stacks: 1, isNotable: false },
]

const renderDrawer = (
  isOpen: boolean,
  onToggle = vi.fn(),
  openShortcuts = vi.fn(),
) =>
  render(
    <ShortcutsOverlayContext.Provider value={{ openShortcuts }}>
      <PlayerInfoDrawer
        initialAuras={auras}
        isOpen={isOpen}
        summary={summary}
        onToggle={onToggle}
      >
        <p>drawer body</p>
      </PlayerInfoDrawer>
    </ShortcutsOverlayContext.Provider>,
  )

describe('PlayerInfoDrawer', () => {
  it('toggles when clicking anywhere on the bar but not the shortcuts button', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const openShortcuts = vi.fn()
    renderDrawer(true, onToggle, openShortcuts)

    await user.click(screen.getByText('Player info'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    await user.click(
      screen.getByRole('button', { name: 'Show keyboard shortcuts' }),
    )
    expect(openShortcuts).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('defaults the body to a third of the viewport height', () => {
    renderDrawer(true)
    expect(
      screen.getByText('drawer body').parentElement?.parentElement,
    ).toHaveStyle({
      height: `${Math.round(window.innerHeight / 3)}px`,
    })
  })

  it('resizes with arrow keys on the drag handle', async () => {
    const user = userEvent.setup()
    const onBodyHeightChange = vi.fn()
    render(
      <ShortcutsOverlayContext.Provider value={{ openShortcuts: vi.fn() }}>
        <PlayerInfoDrawer
          bodyHeight={300}
          initialAuras={auras}
          isOpen
          summary={summary}
          onBodyHeightChange={onBodyHeightChange}
          onToggle={vi.fn()}
        >
          <p>drawer body</p>
        </PlayerInfoDrawer>
      </ShortcutsOverlayContext.Provider>,
    )
    screen.getByRole('separator', { name: 'Resize player info' }).focus()
    await user.keyboard('{ArrowUp}')
    expect(onBodyHeightChange).toHaveBeenCalledWith(324)
  })

  it('shows the body and hides player and auras in the bar when open', () => {
    renderDrawer(true)
    expect(screen.getByText('drawer body')).toBeInTheDocument()
    expect(screen.queryByText('Aegistank')).not.toBeInTheDocument()
    expect(screen.queryByText('Righteous Fury')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Collapse player info' }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows the focused player and initial auras in the bar when collapsed', () => {
    renderDrawer(false)
    expect(screen.getByText('drawer body').closest('[inert]')).not.toBeNull()
    expect(screen.getByText('Aegistank')).toHaveStyle({
      color: summary.color,
    })
    expect(
      screen.getByRole('img', { name: 'Righteous Fury' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: 'Mark of the Wild' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Expand player info' }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('calls onToggle from the chevron and opens shortcuts from the ? button', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const openShortcuts = vi.fn()
    renderDrawer(true, onToggle, openShortcuts)

    await user.click(
      screen.getByRole('button', { name: /collapse player info/i }),
    )
    expect(onToggle).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole('button', { name: 'Show keyboard shortcuts' }),
    )
    expect(openShortcuts).toHaveBeenCalledTimes(1)
  })

  it('keeps the body expanded below 760px, where it is shown as a tab', () => {
    const restoreMatchMedia = stubMatchMedia(true)
    try {
      renderDrawer(false)
      expect(screen.getByText('drawer body')).toBeInTheDocument()
    } finally {
      restoreMatchMedia()
    }
  })
})
