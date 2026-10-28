/**
 * Tests for the fight target crumb shown in the app bar.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FightBarTarget } from './fight-bar-target'

const baseProps = {
  fightName: 'Patchwerk',
  warcraftLogsUrl: 'https://classic.warcraftlogs.com/reports/abc#fight=1',
  targets: [],
  onTargetChange: vi.fn(),
}

describe('FightBarTarget', () => {
  it('links to the fight on Warcraft Logs', () => {
    render(<FightBarTarget {...baseProps} selectedTarget={null} />)

    expect(
      screen.getByRole('link', { name: 'Open Patchwerk on Warcraft Logs' }),
    ).toHaveAttribute('href', baseProps.warcraftLogsUrl)
  })

  it('shows a message when there are no targets', () => {
    render(<FightBarTarget {...baseProps} selectedTarget={null} />)

    expect(screen.getByText('No valid targets available.')).toBeInTheDocument()
  })

  it('renders the target picker when a target is selected', () => {
    render(
      <FightBarTarget
        {...baseProps}
        selectedTarget={{ id: 1, instance: 0 }}
        targets={[
          {
            key: '1:0',
            id: 1,
            instance: 0,
            name: 'Patchwerk',
            label: 'Patchwerk',
            isBoss: true,
          },
        ]}
      />,
    )

    expect(screen.getByLabelText('Target')).toBeInTheDocument()
  })
})
