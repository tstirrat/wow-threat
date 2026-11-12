/**
 * Tests for the transport row layout and cursor readout.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FightWorkspace } from './fight-workspace'
import {
  PlaybackControls,
  type PlaybackControlsProps,
} from './playback-controls'

const baseProps: PlaybackControlsProps = {
  isPlaying: false,
  playbackSpeed: 1,
  hasPlayhead: false,
  playheadMs: null,
  onTogglePlayPause: vi.fn(),
  onIncreaseSpeed: vi.fn(),
  onDecreaseSpeed: vi.fn(),
  onClearPlayhead: vi.fn(),
}

describe('PlaybackControls', () => {
  it('renders inside the transport region of the workspace', () => {
    render(
      <FightWorkspace
        chart={<p>chart</p>}
        transport={<PlaybackControls {...baseProps} />}
      />,
    )

    const transport = screen
      .getByRole('region', { name: 'Fight workspace' })
      .querySelector<HTMLElement>('[data-region="transport"]')
    expect(transport).not.toBeNull()
    expect(
      within(transport as HTMLElement).getByRole('group', {
        name: 'Playback controls',
      }),
    ).toBeInTheDocument()
  })

  it('always shows play and speed, with an empty cursor and no clear before T is set', () => {
    render(<PlaybackControls {...baseProps} />)

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByText('1x')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Replay' })).toBeNull()
    expect(screen.getByTestId('transport-cursor')).toHaveTextContent('Cursor —')
    expect(screen.queryByRole('button', { name: /Clear/ })).toBeNull()
  })

  it('shows the cursor time and a clear button once T is set', async () => {
    const user = userEvent.setup()
    const onClearPlayhead = vi.fn()
    render(
      <PlaybackControls
        {...baseProps}
        hasPlayhead
        playheadMs={65_250}
        playbackSpeed={2}
        onClearPlayhead={onClearPlayhead}
      />,
    )

    expect(screen.getByText('2x')).toBeInTheDocument()
    expect(screen.getByTestId('transport-cursor')).toHaveTextContent(
      'Cursor 1:05.250',
    )

    await user.click(screen.getByRole('button', { name: /Clear/ }))
    expect(onClearPlayhead).toHaveBeenCalledOnce()
  })

  it('shows Pause while playing', () => {
    render(<PlaybackControls {...baseProps} isPlaying />)

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })
})
