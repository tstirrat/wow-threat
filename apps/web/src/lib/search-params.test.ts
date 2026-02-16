/**
 * Unit tests for fight query param parsing utilities.
 */
import { describe, expect, it } from 'vitest'

import {
  applyFightQueryState,
  parsePlayersParam,
  parseTargetSelectionParams,
  parseWindowParams,
  resolveFightQueryState,
} from './search-params'

describe('search-params', () => {
  it('parses player IDs from comma-separated values', () => {
    expect(parsePlayersParam('1,2,abc,3')).toEqual([1, 2, 3])
  })

  it('validates target selection against valid target keys', () => {
    const valid = new Set(['10:0', '10:1'])

    expect(parseTargetSelectionParams('10', null, valid)).toEqual({
      targetId: 10,
      targetInstance: 0,
    })
    expect(parseTargetSelectionParams('10', '1', valid)).toEqual({
      targetId: 10,
      targetInstance: 1,
    })
    expect(parseTargetSelectionParams('10', '3', valid)).toBeNull()
  })

  it('parses valid windows and rejects invalid windows', () => {
    expect(parseWindowParams('100', '200', 500)).toEqual({
      startMs: 100,
      endMs: 200,
    })

    expect(parseWindowParams('100', null, 500)).toEqual({
      startMs: null,
      endMs: null,
    })

    expect(parseWindowParams('300', '200', 500)).toEqual({
      startMs: null,
      endMs: null,
    })
  })

  it('resolves fight query state with fallback behavior', () => {
    const params = new URLSearchParams({
      players: '1,2,999',
      pets: 'true',
      focusId: '2',
      targetId: '20',
      startMs: '100',
      endMs: '200',
    })

    expect(
      resolveFightQueryState({
        searchParams: params,
        validPlayerIds: new Set([1, 2]),
        validActorIds: new Set([1, 2]),
        validTargetKeys: new Set(['20:0']),
        maxDurationMs: 1000,
      }),
    ).toEqual({
      players: [1, 2],
      pets: true,
      focusId: 2,
      targetId: 20,
      targetInstance: 0,
      startMs: 100,
      endMs: 200,
    })
  })

  it('keeps pet focus ids when actor id is valid', () => {
    const params = new URLSearchParams({
      players: '1',
      focusId: '5',
    })

    expect(
      resolveFightQueryState({
        searchParams: params,
        validPlayerIds: new Set([1]),
        validActorIds: new Set([1, 5]),
        validTargetKeys: new Set(),
        maxDurationMs: 1000,
      }),
    ).toEqual({
      players: [1],
      pets: false,
      focusId: 5,
      targetId: null,
      targetInstance: null,
      startMs: null,
      endMs: null,
    })
  })

  it('applies fight query state updates', () => {
    const next = applyFightQueryState(new URLSearchParams(), {
      players: [1, 2],
      pets: true,
      focusId: 1,
      targetId: 99,
      targetInstance: 2,
      startMs: 10,
      endMs: 80,
    })

    expect(next.toString()).toContain('players=1%2C2')
    expect(next.toString()).toContain('pets=true')
    expect(next.toString()).toContain('focusId=1')
    expect(next.toString()).toContain('targetId=99')
    expect(next.toString()).toContain('targetInstance=2')
    expect(next.toString()).toContain('startMs=10')
    expect(next.toString()).toContain('endMs=80')
  })
})
