/**
 * Unit tests for fight-page visible-series legend ordering.
 */
import { describe, expect, it } from 'vitest'

import { buildVisibleSeriesForLegend } from '../lib/fight-page-series'
import type { ThreatSeries } from '../types/app'

function createSeries(
  overrides: Partial<ThreatSeries> & Pick<ThreatSeries, 'actorId' | 'label'>,
): ThreatSeries {
  return {
    actorId: overrides.actorId,
    actorName: overrides.label,
    actorClass: 'Warrior',
    actorType: 'Player',
    ownerId: null,
    label: overrides.label,
    color: '#fff',
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

describe('fight-page visible series', () => {
  it('sorts legend by max threat instead of final total threat', () => {
    const lateThreatDropTank = createSeries({
      actorId: 1,
      label: 'Late Drop Tank',
      maxThreat: 1500,
      totalThreat: 0,
    })
    const steadyDps = createSeries({
      actorId: 2,
      label: 'Steady DPS',
      maxThreat: 900,
      totalThreat: 900,
    })

    const visible = buildVisibleSeriesForLegend(
      [steadyDps, lateThreatDropTank],
      false,
    )

    expect(visible.map((series) => series.actorId)).toEqual([1, 2])
  })

  it('excludes totem pets when pets are shown', () => {
    const player = createSeries({
      actorId: 1,
      label: 'Arrowyn',
      maxThreat: 1000,
    })
    const wolfPet = createSeries({
      actorId: 2,
      label: 'Wolfie (Arrowyn)',
      actorName: 'Wolfie',
      actorType: 'Pet',
      ownerId: 1,
      maxThreat: 500,
    })
    const totemPet = createSeries({
      actorId: 3,
      label: 'Searing Totem (Arrowyn)',
      actorName: 'Searing Totem',
      actorType: 'Pet',
      ownerId: 1,
      maxThreat: 600,
    })

    const visible = buildVisibleSeriesForLegend(
      [player, wolfPet, totemPet],
      true,
    )

    expect(visible.map((series) => series.actorId)).toEqual([1, 2])
  })

  it('groups pets directly under owners when pets are shown', () => {
    const tank = createSeries({
      actorId: 1,
      label: 'Tank',
      maxThreat: 1000,
    })
    const mage = createSeries({
      actorId: 2,
      label: 'Mage',
      maxThreat: 900,
    })
    const magePet = createSeries({
      actorId: 3,
      label: 'Water Elemental (Mage)',
      actorName: 'Water Elemental',
      actorType: 'Pet',
      ownerId: 2,
      maxThreat: 2000,
    })

    const visible = buildVisibleSeriesForLegend([tank, magePet, mage], true)

    expect(visible.map((series) => series.actorId)).toEqual([1, 2, 3])
  })
})
