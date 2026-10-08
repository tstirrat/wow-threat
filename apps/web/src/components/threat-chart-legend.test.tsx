/**
 * Legend mark for players with active threat overrides.
 */
import { render, screen } from '@testing-library/react'
import { type ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { ThreatSeries } from '../types/app'
import { ThreatChartLegend } from './threat-chart-legend'

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

function renderLegend(
  overrides: Partial<ComponentProps<typeof ThreatChartLegend>> = {},
) {
  return render(
    <ThreatChartLegend
      isActorVisible={() => true}
      pinnedPlayerIds={[]}
      series={[
        createSeries({
          actorId: 1,
          actorRole: 'Tank',
          label: 'Aegistank',
        }),
        createSeries({
          actorId: 2,
          actorRole: 'Healer',
          label: 'Arrowyn',
        }),
        createSeries({
          actorId: 3,
          actorRole: 'DPS',
          label: 'Bladefury',
        }),
      ]}
      showClearSelections={false}
      showPets={false}
      onActorClick={vi.fn()}
      onActorFocus={vi.fn()}
      onClearSelections={vi.fn()}
      onOpenPlayerOverrides={vi.fn()}
      onShowPetsChange={vi.fn()}
      onTogglePinnedPlayer={vi.fn()}
      {...overrides}
    />,
  )
}

describe('ThreatChartLegend', () => {
  it('shows an asterisk after the name and role icon when a player has overrides', () => {
    renderLegend({
      actorIdsWithThreatOverrides: new Set([1, 2]),
    })

    const tank = screen.getByRole('button', { name: 'Toggle Aegistank' })
    const healer = screen.getByRole('button', { name: 'Toggle Arrowyn' })
    const damage = screen.getByRole('button', { name: 'Toggle Bladefury' })

    expect(tank.textContent?.replace(/\s+/g, '')).toBe('Aegistank*')
    expect(healer.textContent?.replace(/\s+/g, '')).toBe('Arrowyn*')
    expect(damage.textContent?.replace(/\s+/g, '')).not.toContain('*')
    expect(
      tank.querySelector('[aria-label="Threat overrides active"]'),
    ).toHaveTextContent('*')
    expect(
      healer.querySelector('[aria-label="Threat overrides active"]'),
    ).toHaveTextContent('*')
  })
})
