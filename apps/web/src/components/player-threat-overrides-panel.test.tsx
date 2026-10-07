/**
 * Interaction tests for the floating player threat overrides panel.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { foreverConfig } from '@wow-threat/config'
import { describe, expect, it, vi } from 'vitest'

import { buildThreatOverrideOptions } from '../lib/threat-overrides'
import { PlayerThreatOverridesPanel } from './player-threat-overrides-panel'

describe('PlayerThreatOverridesPanel', () => {
  it('renders config-derived Paladin controls and emits aura changes', () => {
    const onAuraOverrideChange = vi.fn()
    const onClose = vi.fn()
    const options = buildThreatOverrideOptions(foreverConfig, 'Paladin')

    render(
      <PlayerThreatOverridesPanel
        actor={{
          id: 1,
          name: 'Aegis',
          subType: 'Paladin',
          type: 'Player',
        }}
        actorColor="#f58cba"
        actorOverrides={undefined}
        isRecalculating={false}
        options={options}
        onAuraOverrideChange={onAuraOverrideChange}
        onClose={onClose}
        onReset={vi.fn()}
        onTalentRankOverrideChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('complementary', {
        name: 'Threat overrides for Aegis',
      }),
    ).toBeVisible()
    expect(screen.getByText('Righteous Fury')).toBeVisible()
    expect(screen.getByText('Iron Creed')).toBeVisible()
    expect(screen.getByText('Instrument of Law')).toBeVisible()

    fireEvent.click(screen.getByRole('radio', { name: 'Righteous Fury on' }))
    expect(onAuraOverrideChange).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Righteous Fury' }),
      'on',
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Close threat overrides' }),
    )
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows recalculation and reset state for an overridden player', () => {
    render(
      <PlayerThreatOverridesPanel
        actor={{
          id: 1,
          name: 'Aegis',
          subType: 'Paladin',
          type: 'Player',
        }}
        actorColor="#f58cba"
        actorOverrides={{ auras: { '25780': 'on' }, talents: {} }}
        isRecalculating
        options={buildThreatOverrideOptions(foreverConfig, 'Paladin')}
        onAuraOverrideChange={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
        onTalentRankOverrideChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Updating…')).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: 'Reset threat overrides for Aegis',
      }),
    ).toBeVisible()
  })

  it('closes when clicking outside the panel', () => {
    const onClose = vi.fn()

    render(
      <PlayerThreatOverridesPanel
        actor={{
          id: 1,
          name: 'Aegis',
          subType: 'Paladin',
          type: 'Player',
        }}
        actorColor="#f58cba"
        actorOverrides={undefined}
        isRecalculating={false}
        options={buildThreatOverrideOptions(foreverConfig, 'Paladin')}
        onAuraOverrideChange={vi.fn()}
        onClose={onClose}
        onReset={vi.fn()}
        onTalentRankOverrideChange={vi.fn()}
      />,
    )

    fireEvent.pointerDown(screen.getByText('Righteous Fury'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.pointerDown(document.body)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
