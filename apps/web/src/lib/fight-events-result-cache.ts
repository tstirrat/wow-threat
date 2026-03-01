/**
 * IndexedDB-backed cache helpers for processed fight event results.
 */
import type { AugmentedEventsResponse } from '../types/api'

const fightEventsResultCacheDbName = 'wow-threat-client-cache'
const fightEventsResultCacheStoreName = 'fight-events-result-cache'
const fightEventsResultCacheDbVersion = 1
const maxInMemoryEntries = 8

export interface FightEventsResultCacheKey {
  reportCode: string
  fightId: number
  configVersion: string
  inferThreatReduction: boolean
}

interface FightEventsResultCacheRecord extends FightEventsResultCacheKey {
  key: string
  storedAtMs: number
  response: AugmentedEventsResponse
}

const inMemoryResultCache = new Map<string, AugmentedEventsResponse>()
let databasePromise: Promise<IDBDatabase | null> | null = null

function isIndexedDbAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.indexedDB !== 'undefined' &&
    typeof window.indexedDB.open === 'function'
  )
}

function setInMemoryResultCache(
  key: string,
  response: AugmentedEventsResponse,
): void {
  if (inMemoryResultCache.has(key)) {
    inMemoryResultCache.delete(key)
  }

  inMemoryResultCache.set(key, response)

  if (inMemoryResultCache.size <= maxInMemoryEntries) {
    return
  }

  const oldestKey = inMemoryResultCache.keys().next().value
  if (!oldestKey) {
    return
  }

  inMemoryResultCache.delete(oldestKey)
}

function openResultCacheDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null)
  }

  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise((resolve) => {
    const request = window.indexedDB.open(
      fightEventsResultCacheDbName,
      fightEventsResultCacheDbVersion,
    )

    request.onupgradeneeded = () => {
      const database = request.result
      if (
        !database.objectStoreNames.contains(fightEventsResultCacheStoreName)
      ) {
        database.createObjectStore(fightEventsResultCacheStoreName, {
          keyPath: 'key',
        })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      console.warn('[Events] Failed to open IndexedDB fight-events cache')
      resolve(null)
    }
  })

  return databasePromise
}

function withResultCacheStore<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return new Promise((resolve) => {
    const transaction = database.transaction(
      fightEventsResultCacheStoreName,
      mode,
    )
    const store = transaction.objectStore(fightEventsResultCacheStoreName)
    const request = operation(store)

    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      console.warn('[Events] Failed to access IndexedDB fight-events cache')
      resolve(null)
    }
  })
}

/** Build the stable cache key used for processed fight events. */
export function buildFightEventsResultCacheKey(
  params: FightEventsResultCacheKey,
): string {
  const inferThreatReductionToken = params.inferThreatReduction ? '1' : '0'
  return [
    params.reportCode,
    String(params.fightId),
    params.configVersion,
    inferThreatReductionToken,
  ].join(':')
}

/** Read a processed fight-events payload from local cache when available. */
export async function loadFightEventsResultCache(
  params: FightEventsResultCacheKey,
): Promise<AugmentedEventsResponse | null> {
  const cacheKey = buildFightEventsResultCacheKey(params)
  const cachedInMemory = inMemoryResultCache.get(cacheKey)
  if (cachedInMemory) {
    return cachedInMemory
  }

  const database = await openResultCacheDatabase()
  if (!database) {
    return null
  }

  const record = await withResultCacheStore<
    FightEventsResultCacheRecord | undefined
  >(database, 'readonly', (store) => store.get(cacheKey))
  if (!record) {
    return null
  }

  setInMemoryResultCache(cacheKey, record.response)
  return record.response
}

/** Persist a processed fight-events payload for future revisit reuse. */
export async function saveFightEventsResultCache(params: {
  key: FightEventsResultCacheKey
  response: AugmentedEventsResponse
}): Promise<void> {
  const cacheKey = buildFightEventsResultCacheKey(params.key)
  setInMemoryResultCache(cacheKey, params.response)

  const database = await openResultCacheDatabase()
  if (!database) {
    return
  }

  const record: FightEventsResultCacheRecord = {
    ...params.key,
    key: cacheKey,
    storedAtMs: Date.now(),
    response: params.response,
  }
  await withResultCacheStore(database, 'readwrite', (store) =>
    store.put(record),
  )
}
