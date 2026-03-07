/**
 * Unit tests for threat worker IndexedDB cache helpers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildThreatWorkerJobKey,
  chunkThreatWorkerEvents,
  clearThreatWorkerJobRecords,
  loadThreatWorkerProcessedResult,
  loadThreatWorkerRawEventChunks,
  saveThreatWorkerProcessedResult,
  saveThreatWorkerRawEventChunks,
} from './threat-engine-worker-cache'

describe('threat-engine-worker-cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('builds a stable job key from report, fight, and request ids', () => {
    expect(
      buildThreatWorkerJobKey({
        reportId: 'ABC123xyz',
        fightId: 77,
        requestId: 'request-42',
      }),
    ).toBe('ABC123xyz:77:request-42')
  })

  it('chunks event arrays by the configured chunk size', () => {
    expect(chunkThreatWorkerEvents([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ])
  })

  it('falls back to one chunk when chunk size is invalid', () => {
    expect(chunkThreatWorkerEvents([1, 2, 3], 0)).toEqual([[1, 2, 3]])
    expect(chunkThreatWorkerEvents([1, 2, 3], Number.NaN)).toEqual([[1, 2, 3]])
  })

  it('returns fallback values when indexeddb is unavailable', async () => {
    const originalIndexedDb = globalThis.indexedDB
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: undefined,
    })

    try {
      const savedRaw = await saveThreatWorkerRawEventChunks({
        jobKey: 'job-1',
        rawEventChunks: [[]],
      })
      const loadedRaw = await loadThreatWorkerRawEventChunks({
        jobKey: 'job-1',
        rawEventChunkCount: 1,
      })
      const savedProcessed = await saveThreatWorkerProcessedResult({
        jobKey: 'job-1',
        payload: {
          augmentedEvents: [],
          initialAurasByActor: {},
          processDurationMs: 10,
        },
      })
      const loadedProcessed = await loadThreatWorkerProcessedResult('job-1')

      await expect(
        clearThreatWorkerJobRecords({
          jobKey: 'job-1',
          rawEventChunkCount: 1,
        }),
      ).resolves.toBeUndefined()

      expect(savedRaw).toBeNull()
      expect(loadedRaw).toBeNull()
      expect(savedProcessed).toBe(false)
      expect(loadedProcessed).toBeNull()
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: originalIndexedDb,
      })
    }
  })
})
