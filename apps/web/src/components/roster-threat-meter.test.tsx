/**
 * Tests for the combined roster and threat meter.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { ThreatSeries } from '../types/app'
import { RosterThreatMeter } from './roster-threat-meter'

function createSeries(
  overrides: Pick<ThreatSeries, 'actorId' | 'label'> & Partial<ThreatSeries>,
): ThreatSeries {
  return {
    actorName: overrides.label,
    actorClass: null,
    actorType: 'Player',
    ownerId: null,
    color: '#ffffff',
    points: [],
    maxThreat: 0,
    totalThreat: 0,
    totalDamage: 0,
    totalHealing: 0,
    stateVisualSegments: [],
    fixateWindows: [],
    invulnerabilityWindows: [],
    ...overrides,
  }
}

function points(...values: Array<[number, number]>): ThreatSeries['points'] {
  return values.map(([timeMs, totalThreat]) => ({
    timeMs,
    totalThreat,
  })) as ThreatSeries['points']
}

const defaultSeries = [
  createSeries({
    actorId: 1,
    actorRole: 'Tank',
    label: 'Aegistank',
    points: points([0, 0], [10_000, 1000]),
  }),
  createSeries({
    actorId: 2,
    actorRole: 'Healer',
    label: 'Arrowyn',
    points: points([0, 0], [10_000, 200]),
  }),
  createSeries({
    actorId: 3,
    actorRole: 'DPS',
    label: 'Bladefury',
    points: points([0, 0], [5_000, 300], [10_000, 2000]),
  }),
]

function renderRoster(
  overrides: Partial<ComponentProps<typeof RosterThreatMeter>> = {},
) {
  return render(
    <RosterThreatMeter
      focusedActorId={null}
      isActorVisible={() => true}
      pinnedPlayerIds={[]}
      playheadMs={null}
      series={defaultSeries}
      showRawThreat={false}
      showPets={false}
      onActorFocus={vi.fn()}
      onActorIsolate={vi.fn()}
      onSetVisibleActors={vi.fn()}
      onClearPlayerOverrides={vi.fn()}
      onOpenPlayerOverrides={vi.fn()}
      onShowPetsChange={vi.fn()}
      onToggleActorVisibility={vi.fn()}
      onTogglePinnedPlayer={vi.fn()}
      {...overrides}
    />,
  )
}

function rowNames(): string[] {
  return screen
    .getAllByRole('button', { name: /^Focus / })
    .map(
      (button) =>
        button.getAttribute('aria-label')?.replace('Focus ', '') ?? '',
    )
}

describe('RosterThreatMeter', () => {
  it('ranks by final threat when there is no playhead', () => {
    renderRoster()

    expect(rowNames()).toEqual(['Bladefury', 'Aegistank', 'Arrowyn'])
    expect(screen.getByText('End of fight')).toBeTruthy()
  })

  it('ranks by threat at the playhead and shows tps', () => {
    renderRoster({ playheadMs: 5_000 })

    expect(rowNames()).toEqual(['Bladefury', 'Aegistank', 'Arrowyn'])
    const bladefury = screen.getByRole('button', { name: 'Focus Bladefury' })
    expect(within(bladefury).getByTestId('roster-threat').textContent).toBe(
      '300',
    )
    expect(within(bladefury).getByTestId('roster-tps').textContent).toBe('60')
    expect(screen.getByText('0:05.000')).toBeTruthy()
  })

  it('does not show a percentage column', () => {
    renderRoster()

    expect(screen.queryByText(/%/)).toBeNull()
  })

  it('colors the bar and name with the class color', () => {
    renderRoster({
      series: [
        createSeries({
          actorId: 1,
          label: 'Aegistank',
          color: 'rgb(199, 156, 110)',
          points: points([0, 100]),
        }),
      ],
    })

    expect(screen.getByTestId('roster-name').style.color).toBe(
      'rgb(199, 156, 110)',
    )
    const bar = screen.getByTestId('roster-bar')
    expect(bar.style.backgroundColor).toBe('rgb(199, 156, 110)')
    expect(bar.style.width).toBe('100%')
  })

  it('focuses on click and isolates on double click', async () => {
    const user = userEvent.setup()
    const onActorFocus = vi.fn()
    const onActorIsolate = vi.fn()
    renderRoster({ onActorFocus, onActorIsolate })

    await user.dblClick(screen.getByRole('button', { name: 'Focus Arrowyn' }))

    expect(onActorFocus).toHaveBeenCalledWith(2)
    expect(onActorIsolate).toHaveBeenCalledWith(2)
  })

  it('toggles visibility and pin from the row icons', async () => {
    const user = userEvent.setup()
    const onToggleActorVisibility = vi.fn()
    const onTogglePinnedPlayer = vi.fn()
    renderRoster({ onToggleActorVisibility, onTogglePinnedPlayer })

    await user.click(screen.getByRole('button', { name: 'Toggle Aegistank' }))
    await user.click(
      screen.getByRole('button', { name: 'Toggle pin Aegistank' }),
    )

    expect(onToggleActorVisibility).toHaveBeenCalledWith(1)
    expect(onTogglePinnedPlayer).toHaveBeenCalledWith(1)
  })

  it('opens the player context menu with override actions', async () => {
    const user = userEvent.setup()
    const onOpenPlayerOverrides = vi.fn()
    const onClearPlayerOverrides = vi.fn()
    renderRoster({
      actorIdsWithThreatOverrides: new Set([1]),
      onClearPlayerOverrides,
      onOpenPlayerOverrides,
    })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Focus Aegistank' }),
    })
    await user.click(
      await screen.findByRole('menuitem', {
        name: 'Override buffs and talents…',
      }),
    )
    expect(onOpenPlayerOverrides).toHaveBeenCalledWith(1)

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Focus Aegistank' }),
    })
    await user.click(
      await screen.findByRole('menuitem', { name: 'Clear overrides' }),
    )
    expect(onClearPlayerOverrides).toHaveBeenCalledWith(1)
  })

  it('shows the overrides indicator button only for players with overrides', () => {
    renderRoster({ actorIdsWithThreatOverrides: new Set([1]) })

    expect(
      screen.getByRole('button', { name: 'Threat overrides for Aegistank' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Threat overrides for Arrowyn' }),
    ).toBeNull()
  })

  it('filters rows by player name', async () => {
    const user = userEvent.setup()
    renderRoster()

    await user.type(screen.getByLabelText('Filter players'), 'blade')

    expect(rowNames()).toEqual(['Bladefury'])
  })

  it('applies the All, Tanks and Top 5 presets', async () => {
    const user = userEvent.setup()
    const onSetVisibleActors = vi.fn()
    renderRoster({ onSetVisibleActors })

    await user.click(screen.getByRole('button', { name: 'Tanks' }))
    expect(onSetVisibleActors).toHaveBeenLastCalledWith([1])

    await user.click(screen.getByRole('button', { name: 'Top 5' }))
    expect(onSetVisibleActors).toHaveBeenLastCalledWith([3, 1, 2])

    // Everyone is visible, so All hides everyone.
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(onSetVisibleActors).toHaveBeenLastCalledWith([])
  })

  it('shows everyone from All when only some players are visible', async () => {
    const user = userEvent.setup()
    const onSetVisibleActors = vi.fn()
    renderRoster({ isActorVisible: (id) => id === 1, onSetVisibleActors })

    expect(
      screen
        .getByRole('button', { name: 'Tanks' })
        .getAttribute('aria-pressed'),
    ).toBe('true')

    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(onSetVisibleActors).toHaveBeenLastCalledWith([3, 1, 2])
  })

  it('puts the show pets checkbox in the footer', async () => {
    const user = userEvent.setup()
    const onShowPetsChange = vi.fn()
    renderRoster({ onShowPetsChange })

    await user.click(screen.getByLabelText('Show pets'))
    expect(onShowPetsChange).toHaveBeenCalledWith(true)
  })

  it('shortens threat unless raw values are enabled', () => {
    const big = [
      createSeries({
        actorId: 1,
        label: 'Aegistank',
        points: points([0, 0], [10_000, 1_234_567]),
      }),
    ]
    const { unmount } = renderRoster({ series: big })
    expect(screen.getByTestId('roster-threat').textContent).toBe('1.2M')
    unmount()

    renderRoster({ series: big, showRawThreat: true })
    expect(screen.getByTestId('roster-threat').textContent).toBe('1,234,567')
  })
})
