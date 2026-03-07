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

  it('waits for transaction completion before confirming processed result writes', async () => {
    const originalIndexedDb = globalThis.indexedDB
    const putRequest = {
      onerror: null as IDBRequest<IDBValidKey>['onerror'],
      onsuccess: null as IDBRequest<IDBValidKey>['onsuccess'],
    } as IDBRequest<IDBValidKey>
    const processedResultStore = {
      put: vi.fn(() => putRequest),
    } as IDBObjectStore
    const transaction = {
      onabort: null as IDBTransaction['onabort'],
      oncomplete: null as IDBTransaction['oncomplete'],
      onerror: null as IDBTransaction['onerror'],
      objectStore: vi.fn(() => processedResultStore),
    } as IDBTransaction
    const database = {
      createObjectStore: vi.fn(),
      objectStoreNames: {
        contains: vi.fn(() => true),
      } as DOMStringList,
      transaction: vi.fn(() => transaction),
    } as IDBDatabase
    const openRequest = {
      onerror: null as IDBOpenDBRequest['onerror'],
      onsuccess: null as IDBOpenDBRequest['onsuccess'],
      onupgradeneeded: null as IDBOpenDBRequest['onupgradeneeded'],
      result: database,
    } as IDBOpenDBRequest
    const indexedDbFactory = {
      open: vi.fn(() => openRequest),
    } as IDBFactory
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: indexedDbFactory,
    })

    try {
      const savePromise = saveThreatWorkerProcessedResult({
        jobKey: 'job-2',
        payload: {
          augmentedEvents: [],
          initialAurasByActor: {},
          processDurationMs: 10,
        },
      })

      openRequest.onsuccess?.(new Event('success'))
      await Promise.resolve()
      expect(database.transaction).toHaveBeenCalledTimes(1)
      expect(processedResultStore.put).toHaveBeenCalledTimes(1)
      putRequest.onsuccess?.(new Event('success'))

      let hasResolved = false
      void savePromise.then(() => {
        hasResolved = true
      })
      await Promise.resolve()
      expect(hasResolved).toBe(false)

      transaction.oncomplete?.(new Event('complete'))
      await expect(savePromise).resolves.toBe(true)
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: originalIndexedDb,
      })
    }
  })
})
