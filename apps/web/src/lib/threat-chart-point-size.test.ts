/**
 * Unit tests for threat chart point-size rules.
 */
import { describe, expect, it } from 'vitest'

import { resolvePointSize } from './threat-chart-point-size'
import type { SeriesChartPoint } from './threat-chart-types'

function createPoint(overrides: Partial<SeriesChartPoint>): SeriesChartPoint {
  return {
    actorId: 1,
    actorColor: '#ffffff',
    abilityName: 'Test Ability',
    amount: 0,
    baseThreat: 0,
    eventType: 'damage',
    formula: 'test',
    modifiedThreat: 0,
    spellSchool: null,
    modifiers: [],
    threatDelta: 0,
    timeMs: 0,
    totalThreat: 0,
    focusedActorId: 1,
    value: [0, 0],
    ...overrides,
  }
}

describe('threat-chart-point-size', () => {
  it('uses smaller dots for resource and energize events', () => {
    expect(resolvePointSize(createPoint({ eventType: 'resourcechange' }))).toBe(
      4,
    )
    expect(resolvePointSize(createPoint({ eventType: 'energize' }))).toBe(4)
  })

  it('uses larger dots for boss melee markers', () => {
    expect(resolvePointSize(createPoint({ markerKind: 'bossMelee' }))).toBe(9)
  })

  it('keeps death markers at the default marker size', () => {
    expect(resolvePointSize(createPoint({ markerKind: 'death' }))).toBe(8)
  })
})
