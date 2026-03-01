/**
 * Unit tests for processed fight events client-cache helpers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AugmentedEventsResponse } from '../types/api'
import {
  buildFightEventsResultCacheKey,
  loadFightEventsResultCache,
  saveFightEventsResultCache,
} from './fight-events-result-cache'

const testResponse: AugmentedEventsResponse = {
  reportCode: 'ABC123xyz',
  fightId: 12,
  fightName: 'Patchwerk',
  gameVersion: 2,
  configVersion: '974',
  events: [],
  initialAurasByActor: {},
}

describe('fight-events-result-cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('builds a stable cache key with inferThreatReduction partitioning', () => {
    expect(
      buildFightEventsResultCacheKey({
        reportCode: 'ABC123xyz',
        fightId: 12,
        configVersion: '974',
        inferThreatReduction: false,
      }),
    ).toBe('ABC123xyz:12:974:0')

    expect(
      buildFightEventsResultCacheKey({
        reportCode: 'ABC123xyz',
        fightId: 12,
        configVersion: '974',
        inferThreatReduction: true,
      }),
    ).toBe('ABC123xyz:12:974:1')
  })

  it('stores and returns results from in-memory fallback when indexeddb is unavailable', async () => {
    const originalIndexedDb = window.indexedDB
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    })

    try {
      await saveFightEventsResultCache({
        key: {
          reportCode: 'ABC123xyz',
          fightId: 1200,
          configVersion: '974',
          inferThreatReduction: false,
        },
        response: {
          ...testResponse,
          fightId: 1200,
        },
      })

      const cached = await loadFightEventsResultCache({
        reportCode: 'ABC123xyz',
        fightId: 1200,
        configVersion: '974',
        inferThreatReduction: false,
      })

      expect(cached).toEqual({
        ...testResponse,
        fightId: 1200,
      })
    } finally {
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: originalIndexedDb,
      })
    }
  })

  it('keeps inferThreatReduction variants isolated', async () => {
    const originalIndexedDb = window.indexedDB
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    })

    try {
      await saveFightEventsResultCache({
        key: {
          reportCode: 'ABC123xyz',
          fightId: 1201,
          configVersion: '974',
          inferThreatReduction: false,
        },
        response: {
          ...testResponse,
          fightId: 1201,
          fightName: 'No infer fight',
        },
      })
      await saveFightEventsResultCache({
        key: {
          reportCode: 'ABC123xyz',
          fightId: 1201,
          configVersion: '974',
          inferThreatReduction: true,
        },
        response: {
          ...testResponse,
          fightId: 1201,
          fightName: 'Infer fight',
        },
      })

      const noInfer = await loadFightEventsResultCache({
        reportCode: 'ABC123xyz',
        fightId: 1201,
        configVersion: '974',
        inferThreatReduction: false,
      })
      const infer = await loadFightEventsResultCache({
        reportCode: 'ABC123xyz',
        fightId: 1201,
        configVersion: '974',
        inferThreatReduction: true,
      })

      expect(noInfer?.fightName).toBe('No infer fight')
      expect(infer?.fightName).toBe('Infer fight')
    } finally {
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: originalIndexedDb,
      })
    }
  })
})
