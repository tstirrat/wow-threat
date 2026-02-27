/**
 * Unit tests for fight-page slash-command player fuzzy search helpers.
 */
import { describe, expect, it } from 'vitest'

import type { ThreatSeries } from '../types/app'
import {
  buildPlayerSearchOptions,
  filterPlayerSearchOptions,
  resolveFuzzyMatchScore,
} from './player-search'

function createThreatSeries(
  overrides: Partial<ThreatSeries>,
  actorType: ThreatSeries['actorType'] = 'Player',
): ThreatSeries {
  return {
    actorId: 1,
    actorName: 'Player',
    actorClass: null,
    actorType,
    ownerId: null,
    label: 'Player',
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

describe('player search helpers', () => {
  it('builds player-only options in stable order', () => {
    const series: ThreatSeries[] = [
      createThreatSeries({
        actorId: 1,
        actorName: 'Aegistank',
        label: 'Aegistank',
        actorRole: 'Tank',
      }),
      createThreatSeries(
        {
          actorId: 101,
          actorName: 'Wolfie',
          label: 'Wolfie',
          ownerId: 3,
        },
        'Pet',
      ),
      createThreatSeries({
        actorId: 2,
        actorName: 'Bladefury',
        label: 'Bladefury',
      }),
    ]

    expect(buildPlayerSearchOptions(series)).toEqual([
      {
        actorId: 1,
        label: 'Aegistank',
        color: '#ffffff',
        isTank: true,
        aliases: ['Aegistank'],
      },
      {
        actorId: 2,
        label: 'Bladefury',
        color: '#ffffff',
        isTank: false,
        aliases: ['Bladefury'],
      },
    ])
  })

  it('ranks prefix matches above fuzzy subsequence matches', () => {
    const options = [
      {
        actorId: 1,
        label: 'Aegistank',
        color: '#111111',
        isTank: false,
        aliases: ['Aegistank'],
      },
      {
        actorId: 2,
        label: 'Bladefury',
        color: '#222222',
        isTank: false,
        aliases: ['Bladefury'],
      },
    ]

    expect(filterPlayerSearchOptions(options, 'blade')[0]?.actorId).toBe(2)
    expect(filterPlayerSearchOptions(options, 'agst')[0]?.actorId).toBe(1)
  })

  it('matches diacritics and special letters with plain latin queries', () => {
    const options = [
      {
        actorId: 1,
        label: 'B\u00f6ss',
        color: '#111111',
        isTank: false,
        aliases: ['B\u00f6ss'],
      },
      {
        actorId: 2,
        label: 'ßðss',
        color: '#222222',
        isTank: false,
        aliases: ['ßðss'],
      },
    ]

    expect(filterPlayerSearchOptions(options, 'boss')[0]?.actorId).toBe(1)
    expect(
      filterPlayerSearchOptions(options, 'BOS').some(
        (option) => option.actorId === 2,
      ),
    ).toBe(true)
  })

  it('returns null for unmatched queries', () => {
    expect(resolveFuzzyMatchScore('zzz', 'Aegistank')).toBeNull()
  })
})
