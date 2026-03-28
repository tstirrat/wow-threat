/**
 * IndexedDB helpers for threat worker raw chunk and processed-result job records.
 */
import type { AugmentedEvent } from '@wow-threat/shared'
import type { WCLEvent } from '@wow-threat/wcl-types'

const threatWorkerCacheDbName = 'wow-threat-worker-cache'
const threatWorkerCacheDbVersion = 1
const rawEventChunkStoreName = 'threat-worker-raw-event-chunks'
const processedResultStoreName = 'threat-worker-processed-results'
const processedResultChunkSize = 5_000
const processedResultRehydrateYieldIntervalChunks = 2

interface ThreatWorkerRawEventChunkRecord {
  chunkIndex: number
  events: WCLEvent[]
  jobKey: string
  key: string
  storedAtMs: number
}

interface ThreatWorkerProcessedResultMetaRecord {
  chunkCount: number
  eventCount: number
  initialAurasByActor: Record<string, number[]>
  jobKey: string
  key: string
  processDurationMs: number
  recordType: 'meta'
  storedAtMs: number
}

interface ThreatWorkerProcessedResultChunkRecord {
  augmentedEvents: AugmentedEvent[]
  chunkIndex: number
  jobKey: string
  key: string
  recordType: 'chunk'
  storedAtMs: number
}

interface ThreatWorkerLegacyProcessedResultRecord {
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

/** @internal Reset the cached database promise. For use in tests only. */
export function resetDatabasePromiseForTest(): void {
  databasePromise = null
}

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

function createProcessedResultLegacyRecordKey(jobKey: string): string {
  return `${jobKey}:result`
}

function createProcessedResultMetaRecordKey(jobKey: string): string {
  return `${jobKey}:result:meta`
}

function createProcessedResultChunkRecordKey(
  jobKey: string,
  chunkIndex: number,
): string {
  return `${jobKey}:result:chunk:${chunkIndex}`
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
      // Reset before resolving: any caller that awaits this promise and then
      // immediately retries will see null and trigger a fresh open() attempt
      // instead of reusing a cached failed-connection promise.
      databasePromise = null
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

function upsertProcessedResultRecords(
  database: IDBDatabase,
  params: {
    jobKey: string
    payload: ThreatWorkerProcessedEventsPayload
  },
): Promise<{
  chunkCount: number
  didPersist: boolean
}> {
  const { jobKey, payload } = params
  const storedAtMs = Date.now()
  const augmentedEventChunks = chunkThreatWorkerEvents(
    payload.augmentedEvents,
    processedResultChunkSize,
  )
  const metaRecord: ThreatWorkerProcessedResultMetaRecord = {
    chunkCount: augmentedEventChunks.length,
    eventCount: payload.augmentedEvents.length,
    initialAurasByActor: payload.initialAurasByActor,
    jobKey,
    key: createProcessedResultMetaRecordKey(jobKey),
    processDurationMs: payload.processDurationMs,
    recordType: 'meta',
    storedAtMs,
  }
  const chunkRecords = augmentedEventChunks.map(
    (augmentedEvents, chunkIndex) => ({
      augmentedEvents,
      chunkIndex,
      jobKey,
      key: createProcessedResultChunkRecordKey(jobKey, chunkIndex),
      recordType: 'chunk' as const,
      storedAtMs,
    }),
  )

  return new Promise((resolve) => {
    const transaction = database.transaction(
      processedResultStoreName,
      'readwrite',
    )
    const store = transaction.objectStore(processedResultStoreName)
    const metaRequest: IDBRequest<IDBValidKey> = store.put(metaRecord)
    let didSettle = false
    let didRequestFail = false

    const settle = (didPersist: boolean): void => {
      if (didSettle) {
        return
      }

      didSettle = true
      resolve({
        chunkCount: chunkRecords.length,
        didPersist,
      })
    }

    metaRequest.onsuccess = () => {}
    metaRequest.onerror = () => {
      didRequestFail = true
      console.warn('[Events] Failed to persist threat worker processed result')
    }
    chunkRecords.forEach((chunkRecord) => {
      const chunkRequest: IDBRequest<IDBValidKey> = store.put(chunkRecord)
      chunkRequest.onsuccess = () => {}
      chunkRequest.onerror = () => {
        didRequestFail = true
        console.warn(
          '[Events] Failed to persist threat worker processed chunk',
          {
            chunkIndex: chunkRecord.chunkIndex,
            jobKey,
          },
        )
      }
    })
    transaction.oncomplete = () => {
      settle(!didRequestFail)
    }
    transaction.onerror = () => {
      console.warn(
        '[Events] Failed while committing threat worker processed result',
      )
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

function readProcessedResultMetaRecord(
  database: IDBDatabase,
  jobKey: string,
): Promise<ThreatWorkerProcessedResultMetaRecord | null> {
  return new Promise((resolve) => {
    const transaction = database.transaction(
      processedResultStoreName,
      'readonly',
    )
    const store = transaction.objectStore(processedResultStoreName)
    const request: IDBRequest<
      ThreatWorkerProcessedResultMetaRecord | undefined
    > = store.get(createProcessedResultMetaRecordKey(jobKey))

    request.onsuccess = () => {
      resolve(request.result ?? null)
    }
    request.onerror = () => {
      console.warn(
        '[Events] Failed to read threat worker processed result meta',
      )
      resolve(null)
    }
    transaction.onabort = () => {
      console.warn(
        '[Events] Threat worker processed result meta read transaction aborted',
      )
      resolve(null)
    }
  })
}

function readProcessedResultChunkRecords(
  database: IDBDatabase,
  params: {
    chunkCount: number
    jobKey: string
  },
): Promise<ThreatWorkerProcessedResultChunkRecord[] | null> {
  const { chunkCount, jobKey } = params

  return new Promise((resolve) => {
    const transaction = database.transaction(
      processedResultStoreName,
      'readonly',
    )
    const store = transaction.objectStore(processedResultStoreName)
    const recordsByChunkIndex: Array<ThreatWorkerProcessedResultChunkRecord | null> =
      createChunkIndexes(chunkCount).map(() => null)
    let didSettle = false
    let hasReadError = false

    const settle = (
      value: ThreatWorkerProcessedResultChunkRecord[] | null,
    ): void => {
      if (didSettle) {
        return
      }

      didSettle = true
      resolve(value)
    }

    createChunkIndexes(chunkCount).forEach((chunkIndex) => {
      const request: IDBRequest<
        ThreatWorkerProcessedResultChunkRecord | undefined
      > = store.get(createProcessedResultChunkRecordKey(jobKey, chunkIndex))

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
          '[Events] Failed to read one or more threat worker processed chunks',
          {
            chunkCount,
            hasMissingChunks,
            jobKey,
          },
        )
        settle(null)
        return
      }

      settle(recordsByChunkIndex as ThreatWorkerProcessedResultChunkRecord[])
    }
    transaction.onerror = () => {
      console.warn(
        '[Events] Failed while reading threat worker processed chunks',
      )
      settle(null)
    }
    transaction.onabort = () => {
      console.warn(
        '[Events] Threat worker processed chunk read transaction aborted',
      )
      settle(null)
    }
  })
}

function readLegacyProcessedResultRecord(
  database: IDBDatabase,
  jobKey: string,
): Promise<ThreatWorkerLegacyProcessedResultRecord | null> {
  return new Promise((resolve) => {
    const transaction = database.transaction(
      processedResultStoreName,
      'readonly',
    )
    const store = transaction.objectStore(processedResultStoreName)
    const request: IDBRequest<
      ThreatWorkerLegacyProcessedResultRecord | undefined
    > = store.get(createProcessedResultLegacyRecordKey(jobKey))

    request.onsuccess = () => {
      resolve(request.result ?? null)
    }
    request.onerror = () => {
      console.warn(
        '[Events] Failed to read legacy threat worker processed result',
      )
      resolve(null)
    }
    transaction.onabort = () => {
      console.warn(
        '[Events] Legacy threat worker processed result read transaction aborted',
      )
      resolve(null)
    }
  })
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0)
  })
}

async function rehydrateProcessedResultFromChunkRecords(params: {
  chunkRecords: ThreatWorkerProcessedResultChunkRecord[]
  initialAurasByActor: Record<string, number[]>
  processDurationMs: number
}): Promise<ThreatWorkerProcessedEventsPayload> {
  const { chunkRecords, initialAurasByActor, processDurationMs } = params
  const augmentedEvents: AugmentedEvent[] = []

  for (let chunkIndex = 0; chunkIndex < chunkRecords.length; chunkIndex += 1) {
    const chunkRecord = chunkRecords[chunkIndex]
    if (!chunkRecord) {
      continue
    }

    augmentedEvents.push(...chunkRecord.augmentedEvents)
    const shouldYield =
      chunkIndex > 0 &&
      chunkIndex % processedResultRehydrateYieldIntervalChunks === 0
    if (shouldYield) {
      await yieldToMainThread()
    }
  }

  return {
    augmentedEvents,
    initialAurasByActor,
    processDurationMs,
  }
}

async function deleteThreatWorkerJobRecords(
  database: IDBDatabase,
  params: {
    jobKey: string
    rawEventChunkCount: number
  },
): Promise<boolean> {
  const { jobKey, rawEventChunkCount } = params
  const processedMetaRecord = await readProcessedResultMetaRecord(
    database,
    jobKey,
  )
  const processedChunkCount = processedMetaRecord?.chunkCount ?? 0

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
    processedResultStore.delete(createProcessedResultLegacyRecordKey(jobKey))
    processedResultStore.delete(createProcessedResultMetaRecordKey(jobKey))
    createChunkIndexes(processedChunkCount).forEach((chunkIndex) => {
      processedResultStore.delete(
        createProcessedResultChunkRecordKey(jobKey, chunkIndex),
      )
    })

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
  const saveStartedAt = performance.now()
  const database = await openThreatWorkerCacheDatabase()
  if (!database) {
    return false
  }

  const writeResult = await upsertProcessedResultRecords(database, {
    jobKey: params.jobKey,
    payload: params.payload,
  })
  if (writeResult.didPersist) {
    console.info('[Events][Perf] Persisted threat worker processed result', {
      chunkCount: writeResult.chunkCount,
      eventCount: params.payload.augmentedEvents.length,
      jobKey: params.jobKey,
      saveDurationMs: Math.round(performance.now() - saveStartedAt),
    })
  }

  return writeResult.didPersist
}

/** Load processed threat output written by worker-side IndexedDB execution. */
export async function loadThreatWorkerProcessedResult(
  jobKey: string,
): Promise<ThreatWorkerProcessedEventsPayload | null> {
  const loadStartedAt = performance.now()
  const database = await openThreatWorkerCacheDatabase()
  if (!database) {
    return null
  }

  const processedMetaRecord = await readProcessedResultMetaRecord(
    database,
    jobKey,
  )
  if (processedMetaRecord) {
    const readChunksStartedAt = performance.now()
    const chunkRecords = await readProcessedResultChunkRecords(database, {
      chunkCount: processedMetaRecord.chunkCount,
      jobKey,
    })
    if (!chunkRecords) {
      return null
    }

    const rehydrateStartedAt = performance.now()
    const payload = await rehydrateProcessedResultFromChunkRecords({
      chunkRecords,
      initialAurasByActor: processedMetaRecord.initialAurasByActor,
      processDurationMs: processedMetaRecord.processDurationMs,
    })
    console.info('[Events][Perf] Loaded threat worker processed result', {
      chunkCount: processedMetaRecord.chunkCount,
      chunkReadDurationMs: Math.round(performance.now() - readChunksStartedAt),
      eventCount: payload.augmentedEvents.length,
      jobKey,
      loadDurationMs: Math.round(performance.now() - loadStartedAt),
      rehydrateDurationMs: Math.round(performance.now() - rehydrateStartedAt),
    })
    return payload
  }

  const legacyRecord = await readLegacyProcessedResultRecord(database, jobKey)
  if (!legacyRecord) {
    return null
  }

  console.info('[Events][Perf] Loaded legacy threat worker processed result', {
    eventCount: legacyRecord.payload.augmentedEvents.length,
    jobKey,
    loadDurationMs: Math.round(performance.now() - loadStartedAt),
  })

  return legacyRecord.payload
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
