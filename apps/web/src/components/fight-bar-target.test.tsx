/**
 * Tests for the target crumb and Warcraft Logs icon link shown in the app bar.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FightBarTarget, FightBarWarcraftLogsLink } from './fight-bar-target'
import { TooltipProvider } from './ui/tooltip'

const baseProps = {
  targets: [],
  onTargetChange: vi.fn(),
}

describe('FightBarTarget', () => {
  it('shows a message when there are no targets', () => {
    render(<FightBarTarget {...baseProps} selectedTarget={null} />)

    expect(screen.getByText('No valid targets available.')).toBeInTheDocument()
  })

  it('renders the target crumb when a target is selected', () => {
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

    const trigger = screen.getByRole('combobox', { name: 'Target' })
    expect(trigger).not.toHaveTextContent('vs')
    expect(trigger).toHaveTextContent('Patchwerk')
    expect(trigger.className).not.toContain('w-[240px]')
  })
})

describe('FightBarWarcraftLogsLink', () => {
  it('links to the fight on Warcraft Logs as an icon button', () => {
    const url = 'https://classic.warcraftlogs.com/reports/abc#fight=1'
    render(
      <TooltipProvider>
        <FightBarWarcraftLogsLink fightName="Patchwerk" warcraftLogsUrl={url} />
      </TooltipProvider>,
    )

    expect(
      screen.getByRole('link', { name: 'Open Patchwerk on Warcraft Logs' }),
    ).toHaveAttribute('href', url)
  })
})
