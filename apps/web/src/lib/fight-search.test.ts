/**
 * Unit tests for report/fight fuzzy fight search helpers.
 */
import { describe, expect, it } from 'vitest'

import { filterFightSearchOptions } from './fight-search'

describe('filterFightSearchOptions', () => {
  const options = [
    { id: 1, kill: true, name: 'Patchwerk' },
    { id: 2, kill: false, name: 'Naxxramas Trash' },
    { id: 3, kill: true, name: 'Grobbulus' },
  ]

  it('ranks exact matches above prefix and fuzzy matches', () => {
    const ranked = filterFightSearchOptions(options, 'patchwerk')

    expect(ranked[0]?.id).toBe(1)
  })

  it('ranks prefix matches above fuzzy subsequence matches', () => {
    const ranked = filterFightSearchOptions(options, 'grob')

    expect(ranked[0]?.id).toBe(3)
    expect(filterFightSearchOptions(options, 'pwrk')[0]?.id).toBe(1)
  })

  it('returns empty array for unmatched query', () => {
    expect(filterFightSearchOptions(options, 'zzzz')).toEqual([])
  })
})
