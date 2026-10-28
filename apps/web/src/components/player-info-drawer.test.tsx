/**
 * Tests for the player info drawer title bar and collapse behavior.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ShortcutsOverlayContext } from '../routes/app-shell-context'
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
]
const wowhead = { domain: 'tbc' }

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
        wowhead={wowhead}
        onToggle={onToggle}
      >
        <p>drawer body</p>
      </PlayerInfoDrawer>
    </ShortcutsOverlayContext.Provider>,
  )

describe('PlayerInfoDrawer', () => {
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
    expect(screen.queryByText('drawer body')).not.toBeInTheDocument()
    expect(screen.getByText('Aegistank')).toHaveStyle({
      color: summary.color,
    })
    expect(screen.getByText('Righteous Fury')).toBeInTheDocument()
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
})
