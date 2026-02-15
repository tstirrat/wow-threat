/**
 * Tests for talent-rank helper utilities
 */
import type { TalentImplicationContext } from '@wcl-threat/shared'
import { describe, expect, it } from 'vitest'

import { clampRank, inferMappedTalentRank, inferTalent } from './talents'

const createMockCtx = (
  overrides: Partial<TalentImplicationContext> = {},
): TalentImplicationContext =>
  ({
    event: { auras: [] },
    sourceActor: null,
    talentPoints: [0, 0, 0],
    talentRanks: new Map(),
    specId: null,
    ...overrides,
  }) as TalentImplicationContext

describe('clampRank', () => {
  it('returns 0 for negative ranks', () => {
    expect(clampRank(-3, 5)).toBe(0)
  })

  it('caps ranks at maxRank', () => {
    expect(clampRank(9, 5)).toBe(5)
  })

  it('truncates fractional ranks', () => {
    expect(clampRank(2.9, 5)).toBe(2)
  })
})

describe('inferMappedTalentRank', () => {
  it('infers rank from rank-mapped spell IDs', () => {
    const talentRanks = new Map<number, number>([[1002, 1]])
    const rankByTalentId = new Map<number, number>([
      [1001, 1],
      [1002, 2],
      [1003, 3],
    ])

    expect(inferMappedTalentRank(talentRanks, rankByTalentId, 3)).toBe(2)
  })

  it('uses explicit rank values when provided for mapped IDs', () => {
    const talentRanks = new Map<number, number>([[1001, 3]])
    const rankByTalentId = new Map<number, number>([[1001, 1]])

    expect(inferMappedTalentRank(talentRanks, rankByTalentId, 5)).toBe(3)
  })

  it('ignores unmapped talent IDs', () => {
    const talentRanks = new Map<number, number>([[9999, 5]])
    const rankByTalentId = new Map<number, number>([[1001, 1]])

    expect(inferMappedTalentRank(talentRanks, rankByTalentId, 5)).toBe(0)
  })
})

describe('inferTalent', () => {
  const rankSpellIds = [1001, 1002, 1003] as const

  it('returns spellId when talentRanks has a matching rank', () => {
    const ctx = createMockCtx({
      talentRanks: new Map([[1002, 1]]),
    })

    expect(inferTalent(ctx, rankSpellIds)).toBe(1002)
  })

  it('returns highest matching spellId when multiple ranks present', () => {
    const ctx = createMockCtx({
      talentRanks: new Map([
        [1001, 1],
        [1002, 1],
        [1003, 1],
      ]),
    })

    expect(inferTalent(ctx, rankSpellIds)).toBe(1003)
  })

  it('returns undefined when no talentRanks match and no predicate', () => {
    const ctx = createMockCtx({
      talentRanks: new Map([[9999, 1]]),
    })

    expect(inferTalent(ctx, rankSpellIds)).toBeUndefined()
  })

  it('uses predicate to infer rank when no explicit talentRanks match', () => {
    const ctx = createMockCtx({
      talentPoints: [0, 15, 0],
      talentRanks: new Map(),
    })

    const result = inferTalent(ctx, rankSpellIds, (points) =>
      (points[1] ?? 0) >= 10 ? 3 : 0,
    )

    expect(result).toBe(1003)
  })

  it('returns undefined when predicate returns 0', () => {
    const ctx = createMockCtx({
      talentPoints: [0, 5, 0],
      talentRanks: new Map(),
    })

    const result = inferTalent(ctx, rankSpellIds, (points) =>
      (points[1] ?? 0) >= 10 ? 3 : 0,
    )

    expect(result).toBeUndefined()
  })

  it('prioritizes explicit talentRanks over predicate', () => {
    const ctx = createMockCtx({
      talentPoints: [0, 20, 0],
      talentRanks: new Map([[1001, 1]]),
    })

    const result = inferTalent(ctx, rankSpellIds, (points) =>
      (points[1] ?? 0) >= 10 ? 3 : 0,
    )

    expect(result).toBe(1001)
  })

  it('returns undefined when predicate returns rank out of bounds', () => {
    const ctx = createMockCtx({
      talentPoints: [0, 0, 0],
      talentRanks: new Map(),
    })

    const result = inferTalent(ctx, rankSpellIds, () => 10)

    expect(result).toBeUndefined()
  })

  it('returns undefined when predicate returns negative rank', () => {
    const ctx = createMockCtx({
      talentPoints: [0, 0, 0],
      talentRanks: new Map(),
    })

    const result = inferTalent(ctx, rankSpellIds, () => -1)

    expect(result).toBeUndefined()
  })
})
