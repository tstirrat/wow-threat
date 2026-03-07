/**
 * IndexedDB helpers for threat worker raw chunk and processed-result job records.
 */
import type { AugmentedEvent } from '@wow-threat/shared'
import type { WCLEvent } from '@wow-threat/wcl-types'

const threatWorkerCacheDbName = 'wow-threat-worker-cache'
const threatWorkerCacheDbVersion = 1
const rawEventChunkStoreName = 'threat-worker-raw-event-chunks'
const processedResultStoreName = 'threat-worker-processed-results'

interface ThreatWorkerRawEventChunkRecord {
  chunkIndex: number
  events: WCLEvent[]
  jobKey: string
  key: string
  storedAtMs: number
}

interface ThreatWorkerProcessedResultRecord {
  jobKey: string
  key: string
  payload: ThreatWorkerProcessedEventsPayload
  storedAtMs: number
}

export interface ThreatWorkerProcessedEventsPayload {
  augmentedEvents: AugmentedEvent[]
  initialAurasByActor: Record<string, number[]>
  processDurationMs: number
}

export interface ThreatWorkerJobKeyParams {
  fightId: number
  reportId: string
  requestId: string
}

export interface ThreatWorkerRawChunkWriteResult {
  rawEventChunkCount: number
  rawEventCount: number
}

let databasePromise: Promise<IDBDatabase | null> | null = null

function isIndexedDbAvailable(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.indexedDB !== 'undefined' &&
    typeof globalThis.indexedDB.open === 'function'
  )
}

function createChunkIndexes(chunkCount: number): number[] {
  return Array.from(
    {
      length: chunkCount,
    },
    (_, index) => index,
  )
}

function createRawChunkRecordKey(jobKey: string, chunkIndex: number): string {
  return `${jobKey}:raw:${chunkIndex}`
}

function createProcessedResultRecordKey(jobKey: string): string {
  return `${jobKey}:result`
}

function openThreatWorkerCacheDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null)
  }

  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise((resolve) => {
    const request = globalThis.indexedDB.open(
      threatWorkerCacheDbName,
      threatWorkerCacheDbVersion,
    )

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(rawEventChunkStoreName)) {
        database.createObjectStore(rawEventChunkStoreName, {
          keyPath: 'key',
        })
      }

      if (!database.objectStoreNames.contains(processedResultStoreName)) {
        database.createObjectStore(processedResultStoreName, {
          keyPath: 'key',
        })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      console.warn('[Events] Failed to open threat worker IndexedDB cache')
      resolve(null)
    }
  })

  return databasePromise
}

function writeRawEventChunkRecords(
  database: IDBDatabase,
  records: ThreatWorkerRawEventChunkRecord[],
): Promise<boolean> {
  return new Promise((resolve) => {
    const transaction = database.transaction(
      rawEventChunkStoreName,
      'readwrite',
    )
    const store = transaction.objectStore(rawEventChunkStoreName)
    let didSettle = false

    const settle = (result: boolean): void => {
      if (didSettle) {
        return
      }

      didSettle = true
      resolve(result)
    }

    records.forEach((record) => {
      store.put(record)
    })

    transaction.oncomplete = () => {
      settle(true)
    }
    transaction.onerror = () => {
      console.warn('[Events] Failed to persist threat worker raw chunks')
      settle(false)
    }
    transaction.onabort = () => {
      console.warn('[Events] Threat worker raw chunk transaction aborted')
      settle(false)
    }
  })
}

function readRawEventChunkRecords(
  database: IDBDatabase,
  params: {
    jobKey: string
    rawEventChunkCount: number
  },
): Promise<ThreatWorkerRawEventChunkRecord[] | null> {
  const { jobKey, rawEventChunkCount } = params

  return new Promise((resolve) => {
    const transaction = database.transaction(rawEventChunkStoreName, 'readonly')
    const store = transaction.objectStore(rawEventChunkStoreName)
    const recordsByChunkIndex: Array<ThreatWorkerRawEventChunkRecord | null> =
      createChunkIndexes(rawEventChunkCount).map(() => null)
    let didSettle = false
    let hasReadError = false

    const settle = (value: ThreatWorkerRawEventChunkRecord[] | null): void => {
      if (didSettle) {
        return
      }

      didSettle = true
      resolve(value)
    }

    createChunkIndexes(rawEventChunkCount).forEach((chunkIndex) => {
      const request: IDBRequest<ThreatWorkerRawEventChunkRecord | undefined> =
        store.get(createRawChunkRecordKey(jobKey, chunkIndex))

      request.onsuccess = () => {
        recordsByChunkIndex[chunkIndex] = request.result ?? null
      }
      request.onerror = () => {
        hasReadError = true
      }
    })

    transaction.oncomplete = () => {
      const hasMissingChunks = recordsByChunkIndex.some((record) => !record)
      if (hasReadError || hasMissingChunks) {
        console.warn(
          '[Events] Failed to read one or more threat worker chunks',
          {
            hasMissingChunks,
            jobKey,
            rawEventChunkCount,
          },
        )
        settle(null)
        return
      }

      settle(recordsByChunkIndex as ThreatWorkerRawEventChunkRecord[])
    }
    transaction.onerror = () => {
      console.warn('[Events] Failed while reading threat worker raw chunks')
      settle(null)
    }
    transaction.onabort = () => {
      console.warn('[Events] Threat worker raw chunk read transaction aborted')
      settle(null)
    }
  })
}

function upsertProcessedResultRecord(
  database: IDBDatabase,
  record: ThreatWorkerProcessedResultRecord,
): Promise<boolean> {
  return new Promise((resolve) => {
    const transaction = database.transaction(
      processedResultStoreName,
      'readwrite',
    )
    const store = transaction.objectStore(processedResultStoreName)
    const request: IDBRequest<IDBValidKey> = store.put(record)
    let didSettle = false

    const settle = (result: boolean): void => {
      if (didSettle) {
        return
      }

      didSettle = true
      resolve(result)
    }

    request.onsuccess = () => {
      settle(true)
    }
    request.onerror = () => {
      console.warn('[Events] Failed to persist threat worker processed result')
      settle(false)
    }
    transaction.onabort = () => {
      console.warn(
        '[Events] Threat worker processed result transaction aborted',
      )
      settle(false)
    }
  })
}

function readProcessedResultRecord(
  database: IDBDatabase,
  jobKey: string,
): Promise<ThreatWorkerProcessedResultRecord | null> {
  return new Promise((resolve) => {
    const transaction = database.transaction(
      processedResultStoreName,
      'readonly',
    )
    const store = transaction.objectStore(processedResultStoreName)
    const request: IDBRequest<ThreatWorkerProcessedResultRecord | undefined> =
      store.get(createProcessedResultRecordKey(jobKey))

    request.onsuccess = () => {
      resolve(request.result ?? null)
    }
    request.onerror = () => {
      console.warn('[Events] Failed to read threat worker processed result')
      resolve(null)
    }
    transaction.onabort = () => {
      console.warn(
        '[Events] Threat worker processed result read transaction aborted',
      )
      resolve(null)
    }
  })
}

function deleteThreatWorkerJobRecords(
  database: IDBDatabase,
  params: {
    jobKey: string
    rawEventChunkCount: number
  },
): Promise<boolean> {
  const { jobKey, rawEventChunkCount } = params

  return new Promise((resolve) => {
    const transaction = database.transaction(
      [rawEventChunkStoreName, processedResultStoreName],
      'readwrite',
    )
    const rawChunkStore = transaction.objectStore(rawEventChunkStoreName)
    const processedResultStore = transaction.objectStore(
      processedResultStoreName,
    )
    let didSettle = false

    const settle = (result: boolean): void => {
      if (didSettle) {
        return
      }

      didSettle = true
      resolve(result)
    }

    createChunkIndexes(rawEventChunkCount).forEach((chunkIndex) => {
      rawChunkStore.delete(createRawChunkRecordKey(jobKey, chunkIndex))
    })
    processedResultStore.delete(createProcessedResultRecordKey(jobKey))

    transaction.oncomplete = () => {
      settle(true)
    }
    transaction.onerror = () => {
      console.warn('[Events] Failed to clean threat worker job records')
      settle(false)
    }
    transaction.onabort = () => {
      console.warn('[Events] Threat worker cleanup transaction aborted')
      settle(false)
    }
  })
}

/** Build a unique per-request key for threat worker IndexedDB job records. */
export function buildThreatWorkerJobKey(
  params: ThreatWorkerJobKeyParams,
): string {
  return [params.reportId, String(params.fightId), params.requestId].join(':')
}

/** Split events into deterministic chunk groups for transfer and persistence. */
export function chunkThreatWorkerEvents<T>(
  events: T[],
  chunkSize: number,
): T[][] {
  if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
    return [events]
  }

  return createChunkIndexes(Math.ceil(events.length / chunkSize)).map(
    (chunkIndex) => {
      const start = chunkIndex * chunkSize
      return events.slice(start, start + chunkSize)
    },
  )
}

/** Persist raw fight event chunks for a worker job. */
export async function saveThreatWorkerRawEventChunks(params: {
  jobKey: string
  rawEventChunks: WCLEvent[][]
}): Promise<ThreatWorkerRawChunkWriteResult | null> {
  const { jobKey, rawEventChunks } = params
  const database = await openThreatWorkerCacheDatabase()
  if (!database) {
    return null
  }

  const records = rawEventChunks.map((events, chunkIndex) => ({
    chunkIndex,
    events,
    jobKey,
    key: createRawChunkRecordKey(jobKey, chunkIndex),
    storedAtMs: Date.now(),
  }))

  const didPersist = await writeRawEventChunkRecords(database, records)
  if (!didPersist) {
    return null
  }

  return {
    rawEventChunkCount: records.length,
    rawEventCount: records.reduce(
      (totalEvents, record) => totalEvents + record.events.length,
      0,
    ),
  }
}

/** Load raw fight event chunks for worker-side processing. */
export async function loadThreatWorkerRawEventChunks(params: {
  jobKey: string
  rawEventChunkCount: number
}): Promise<WCLEvent[] | null> {
  const { jobKey, rawEventChunkCount } = params
  const database = await openThreatWorkerCacheDatabase()
  if (!database) {
    return null
  }

  const records = await readRawEventChunkRecords(database, {
    jobKey,
    rawEventChunkCount,
  })
  if (!records) {
    return null
  }

  return records.flatMap((record) => record.events)
}

/** Persist processed threat output for retrieval by the main thread. */
export async function saveThreatWorkerProcessedResult(params: {
  jobKey: string
  payload: ThreatWorkerProcessedEventsPayload
}): Promise<boolean> {
  const database = await openThreatWorkerCacheDatabase()
  if (!database) {
    return false
  }

  return upsertProcessedResultRecord(database, {
    jobKey: params.jobKey,
    key: createProcessedResultRecordKey(params.jobKey),
    payload: params.payload,
    storedAtMs: Date.now(),
  })
}

/** Load processed threat output written by worker-side IndexedDB execution. */
export async function loadThreatWorkerProcessedResult(
  jobKey: string,
): Promise<ThreatWorkerProcessedEventsPayload | null> {
  const database = await openThreatWorkerCacheDatabase()
  if (!database) {
    return null
  }

  const record = await readProcessedResultRecord(database, jobKey)
  return record?.payload ?? null
}

/** Delete all stored raw chunks and processed output for a job key. */
export async function clearThreatWorkerJobRecords(params: {
  jobKey: string
  rawEventChunkCount: number
}): Promise<void> {
  const database = await openThreatWorkerCacheDatabase()
  if (!database) {
    return
  }

  await deleteThreatWorkerJobRecords(database, params)
}
