/**
 * Tests for the app bar roster toggle button.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RosterToggleButton } from './roster-toggle-button'

describe('RosterToggleButton', () => {
  it('offers to hide a visible roster and calls onToggle', async () => {
    const onToggle = vi.fn()
    render(<RosterToggleButton isRosterVisible onToggle={onToggle} />)

    const button = screen.getByRole('button', { name: 'Hide roster' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('offers to show a hidden roster', () => {
    render(<RosterToggleButton isRosterVisible={false} onToggle={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Show roster' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
