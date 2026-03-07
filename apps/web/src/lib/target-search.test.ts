/**
 * Unit tests for fuzzy target search option ranking.
 */
import { describe, expect, it } from 'vitest'

import {
  type TargetSearchOption,
  filterTargetSearchOptions,
} from './target-search'

const targetOptions: TargetSearchOption[] = [
  {
    id: 100,
    instance: 1,
    key: '100:1',
    name: 'Patchwerk',
    label: 'Patchwerk (100)',
    isBoss: true,
  },
  {
    id: 200,
    instance: 2,
    key: '200:2',
    name: 'Patchwork Construct',
    label: 'Patchwork Construct (200)',
    isBoss: false,
  },
  {
    id: 300,
    instance: 3,
    key: '300:3',
    name: 'Hateful Strike Target',
    label: 'Hateful Strike Target (300)',
    isBoss: false,
  },
  {
    id: 400,
    instance: 4,
    key: '400:4',
    name: 'Target Dummy Boss',
    label: 'Target Dummy Boss (400)',
    isBoss: true,
  },
]

describe('filterTargetSearchOptions', () => {
  it('returns bosses before non-bosses when query is empty', () => {
    expect(
      filterTargetSearchOptions(targetOptions, '').map((option) => option.key),
    ).toEqual(['100:1', '400:4', '200:2', '300:3'])
  })

  it('prioritizes exact then prefix then fuzzy matches', () => {
    const results = filterTargetSearchOptions(targetOptions, 'patch')

    expect(results[0]?.key).toBe('100:1')
    expect(results[1]?.key).toBe('200:2')
  })

  it('ranks boss targets ahead of non-boss targets within the same match tier', () => {
    const results = filterTargetSearchOptions(targetOptions, 'target')

    expect(results.map((option) => option.key)).toEqual(['400:4', '300:3'])
  })

  it('returns fuzzy subsequence matches when direct contains is missing', () => {
    const results = filterTargetSearchOptions(targetOptions, 'hs target')

    expect(results.map((option) => option.key)).toEqual(['300:3'])
  })
})
