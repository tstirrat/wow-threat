/**
 * Client-side fight event processing using raw paginated events.
 */
import { resolveConfigOrNull } from '@wow-threat/config'
import { ThreatEngine, buildThreatEngineInput } from '@wow-threat/engine'
import type {
  Report,
  ReportActor,
  ReportFight,
  WCLEvent,
} from '@wow-threat/wcl-types'

import { getFightEventsPage } from '../api/reports'
import {
  buildThreatWorkerJobKey,
  chunkThreatWorkerEvents,
  clearThreatWorkerJobRecords,
  loadThreatWorkerProcessedResult,
  saveThreatWorkerRawEventChunks,
} from '../lib/threat-engine-worker-cache'
import type {
  AugmentedEventsResponse,
  FightEventsResponse,
  FightsResponse,
  ReportAbilitySummary,
  ReportActorSummary,
  ReportFightParticipant,
  ReportFightSummary,
  ReportResponse,
} from '../types/api'
import type {
  ThreatEngineWorkerPayload,
  ThreatEngineWorkerProcessedPayload,
  ThreatEngineWorkerRequest,
  ThreatEngineWorkerResponse,
  ThreatEngineWorkerSuccessResponse,
} from '../workers/threat-engine-worker-types'

const fallbackThreatEngine = new ThreatEngine()
const defaultRawEventChunkSize = 10_000

export type ThreatEngineProcessMode = 'worker' | 'main-thread'

export interface ClientThreatEngineProgressUpdate {
  phase: 'loading-pages' | 'processing' | 'complete'
  message: string
  pagesLoaded: number
  eventsLoaded: number
  mode?: ThreatEngineProcessMode
}

function createAbortError(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('Threat event loading was cancelled', 'AbortError')
  }

  const fallbackError = new Error('Threat event loading was cancelled')
  fallbackError.name = 'AbortError'
  return fallbackError
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

function formatEventCount(eventCount: number): string {
  return new Intl.NumberFormat().format(eventCount)
}

function toErrorDetails(error: unknown): {
  message: string
  name?: string
  stack?: string
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    }
  }

  return {
    message: String(error),
  }
}

function isIndexedDbWorkerError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return error.message.toLowerCase().includes('indexeddb')
}

function toReportFightParticipant(
  participant: ReportFightParticipant,
): ReportFight['enemyNPCs'][number] {
  return {
    id: participant.id,
    gameID: participant.gameID,
    instanceCount: participant.instanceCount,
    groupCount: participant.groupCount,
    petOwner: participant.petOwner,
  }
}

function toReportFight(fight: ReportFightSummary): ReportFight {
  return {
    id: fight.id,
    encounterID: fight.encounterID ?? null,
    classicSeasonID: fight.classicSeasonID ?? null,
    name: fight.name,
    startTime: fight.startTime,
    endTime: fight.endTime,
    kill: fight.kill,
    difficulty: fight.difficulty,
    bossPercentage: fight.bossPercentage,
    fightPercentage: fight.fightPercentage,
    enemyNPCs: fight.enemyNPCs.map(toReportFightParticipant),
    enemyPets: fight.enemyPets.map(toReportFightParticipant),
    friendlyPlayers: [...fight.friendlyPlayers],
    friendlyPets: fight.friendlyPets.map(toReportFightParticipant),
  }
}

function toReportAbility(
  ability: ReportAbilitySummary,
): Report['masterData']['abilities'][number] {
  return {
    gameID: ability.gameID,
    icon: ability.icon,
    name: ability.name,
    type: ability.type,
  }
}

function toReportActors(actors: ReportActorSummary[]): ReportActor[] {
  return actors.flatMap((actor) => {
    if (actor.type === 'Player') {
      if (
        !actor.subType ||
        actor.subType === 'Boss' ||
        actor.subType === 'NPC'
      ) {
        return []
      }

      return [
        {
          id: actor.id,
          gameID: actor.gameID,
          name: actor.name,
          subType: actor.subType,
          type: 'Player',
        },
      ]
    }

    if (actor.type === 'NPC') {
      return [
        {
          id: actor.id,
          gameID: actor.gameID,
          name: actor.name,
          subType: actor.subType === 'Boss' ? 'Boss' : 'NPC',
          type: 'NPC',
        },
      ]
    }

    return [
      {
        id: actor.id,
        gameID: actor.gameID,
        name: actor.name,
        petOwner: actor.petOwner ?? null,
        type: 'Pet',
      },
    ]
  })
}

function extractTankActorIds(fightData: FightsResponse): number[] {
  return [
    ...new Set(
      fightData.actors
        .filter((actor) => actor.type === 'Player' && actor.role === 'Tank')
        .map((actor) => actor.id),
    ),
  ].sort((left, right) => left - right)
}

function createWorkerRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function resolveRawEventChunkSize(chunkSize: number | undefined): number {
  if (!Number.isFinite(chunkSize) || !chunkSize || chunkSize <= 0) {
    return defaultRawEventChunkSize
  }

  return Math.max(1, Math.trunc(chunkSize))
}

function createThreatEngineWorker(): Worker {
  return new Worker(
    new URL('../workers/threat-engine.worker.ts', import.meta.url),
    {
      type: 'module',
    },
  )
}

async function runThreatEngineWorker(
  payload: ThreatEngineWorkerPayload,
  signal?: AbortSignal,
): Promise<ThreatEngineWorkerResponse> {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers are unavailable in this environment')
  }

  throwIfAborted(signal)

  const worker = createThreatEngineWorker()
  const requestId = createWorkerRequestId()
  const workerStartedAt = performance.now()
  const request: ThreatEngineWorkerRequest = {
    requestId,
    payload,
  }
  console.info('[Events] Starting threat worker request', {
    fightId: payload.fightId,
    inferThreatReduction: payload.inferThreatReduction,
    inputMode: payload.inputMode,
    rawEventCount:
      payload.inputMode === 'direct'
        ? payload.rawEvents.length
        : payload.rawEventCount,
    reportAbilityCount: payload.report.masterData.abilities.length,
    reportCode: payload.report.code,
    reportFightCount: payload.report.fights.length,
    requestId,
    tankActorCount: payload.tankActorIds.length,
  })

  return new Promise<ThreatEngineWorkerResponse>((resolve, reject) => {
    const timeoutHandle = globalThis.setTimeout(() => {
      worker.terminate()
      reject(new Error('Threat engine worker timed out after 120000ms'))
    }, 120_000)

    const handleAbort = (): void => {
      cleanup()
      reject(createAbortError())
    }

    const cleanup = (): void => {
      globalThis.clearTimeout(timeoutHandle)
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
      worker.removeEventListener('messageerror', handleMessageError)
      signal?.removeEventListener('abort', handleAbort)
      worker.terminate()
    }

    const handleError = (event: ErrorEvent): void => {
      cleanup()
      reject(
        new Error(
          `Threat engine worker failed to execute: ${event.message || 'unknown error'}`,
        ),
      )
    }

    const handleMessageError = (event: MessageEvent): void => {
      cleanup()
      const messageType =
        event.data === null
          ? 'null'
          : typeof event.data === 'object'
            ? 'object'
            : typeof event.data
      reject(
        new Error(
          `Threat engine worker returned an invalid message payload (${messageType})`,
        ),
      )
    }

    const handleMessage = (
      message: MessageEvent<ThreatEngineWorkerResponse>,
    ): void => {
      if (message.data.requestId !== requestId) {
        return
      }

      const workerElapsedMs = Math.round(performance.now() - workerStartedAt)
      console.info('[Events] Threat worker returned response', {
        requestId,
        status: message.data.status,
        workerElapsedMs,
      })
      cleanup()
      resolve(message.data)
    }

    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError)
    worker.addEventListener('messageerror', handleMessageError)
    signal?.addEventListener('abort', handleAbort, {
      once: true,
    })
    throwIfAborted(signal)
    worker.postMessage(request)
  })
}

function deserializeInitialAurasByActor(
  initialAurasByActor: Record<string, number[]> | undefined,
): Map<number, readonly number[]> {
  if (!initialAurasByActor) {
    return new Map()
  }

  return Object.entries(initialAurasByActor).reduce(
    (result, [actorId, auraIds]) => {
      const parsedActorId = Number.parseInt(actorId, 10)
      if (!Number.isFinite(parsedActorId)) {
        return result
      }

      const sanitizedAuraIds = auraIds
        .filter((auraId) => Number.isFinite(auraId))
        .map((auraId) => Math.trunc(auraId))
      if (sanitizedAuraIds.length === 0) {
        return result
      }

      result.set(
        parsedActorId,
        [...new Set(sanitizedAuraIds)].sort((left, right) => left - right),
      )
      return result
    },
    new Map<number, readonly number[]>(),
  )
}

function serializeInitialAurasByActor(
  initialAurasByActor: Map<number, readonly number[]>,
): Record<string, number[]> {
  return Object.fromEntries(
    [...initialAurasByActor.entries()]
      .filter(([, auraIds]) => auraIds.length > 0)
      .map(([actorId, auraIds]) => [
        String(actorId),
        [...new Set(auraIds)].sort((left, right) => left - right),
      ]),
  )
}

function processThreatEventsOnMainThread(params: {
  fightId: number
  inferThreatReduction: boolean
  initialAurasByActor?: Record<string, number[]>
  rawEvents: WCLEvent[]
  report: Report
  tankActorIds: number[]
}): ThreatEngineWorkerProcessedPayload {
  const {
    fightId,
    inferThreatReduction,
    initialAurasByActor: serializedInitialAurasByActor,
    rawEvents,
    report,
    tankActorIds,
  } = params
  const startedAt = performance.now()
  const fight = report.fights.find(
    (candidateFight) => candidateFight.id === fightId,
  )
  if (!fight) {
    throw new Error(`fight ${fightId} not found in report payload`)
  }

  const config = resolveConfigOrNull({
    report,
  })
  if (!config) {
    throw new Error(
      `no threat config for gameVersion ${report.masterData.gameVersion}`,
    )
  }

  const initialAurasByActor = deserializeInitialAurasByActor(
    serializedInitialAurasByActor,
  )
  const { actorMap, friendlyActorIds, enemies, abilitySchoolMap } =
    buildThreatEngineInput({
      fight,
      actors: report.masterData.actors,
      abilities: report.masterData.abilities,
    })
  const { augmentedEvents, initialAurasByActor: effectiveInitialAurasByActor } =
    fallbackThreatEngine.processEvents({
      rawEvents,
      initialAurasByActor,
      actorMap,
      friendlyActorIds,
      abilitySchoolMap,
      enemies,
      encounterId: fight.encounterID ?? null,
      report,
      fight,
      inferThreatReduction,
      tankActorIds: new Set(tankActorIds),
      config,
    })

  return {
    augmentedEvents,
    initialAurasByActor: serializeInitialAurasByActor(
      effectiveInitialAurasByActor,
    ),
    processDurationMs: Math.round(performance.now() - startedAt),
  }
}

async function fetchAllRawEvents(
  reportId: string,
  fightId: number,
  signal: AbortSignal | undefined,
  onProgress:
    | ((progress: ClientThreatEngineProgressUpdate) => void)
    | undefined,
): Promise<{
  events: WCLEvent[]
  metadata: FightEventsResponse
  pageCount: number
}> {
  const allEvents: WCLEvent[] = []
  const seenCursors = new Set<number>()
  let cursor: number | undefined
  let pageCount = 0
  let metadata: FightEventsResponse | null = null

  while (true) {
    throwIfAborted(signal)
    const page = await getFightEventsPage(reportId, fightId, cursor, signal)
    throwIfAborted(signal)
    pageCount += 1
    if (!metadata) {
      metadata = page
    }
    allEvents.push(...page.events)
    onProgress?.({
      phase: 'loading-pages',
      pagesLoaded: pageCount,
      eventsLoaded: allEvents.length,
      message: `Loading events pages (${pageCount} loaded, ${formatEventCount(
        allEvents.length,
      )} events)`,
    })

    const nextPageTimestamp = page.nextPageTimestamp
    if (nextPageTimestamp === null) {
      break
    }

    if (seenCursors.has(nextPageTimestamp)) {
      throw new Error(
        `raw events paging loop detected at cursor ${nextPageTimestamp}`,
      )
    }
    seenCursors.add(nextPageTimestamp)
    cursor = nextPageTimestamp
  }

  if (!metadata) {
    throw new Error('raw events response was empty')
  }

  return {
    events: allEvents,
    metadata,
    pageCount,
  }
}

export interface RawFightEventsData {
  events: WCLEvent[]
  metadata: FightEventsResponse
  pageCount: number
}

/** Fetch all paginated raw events for a fight. */
export async function getFightRawEventsClientSide(params: {
  reportId: string
  fightId: number
  signal?: AbortSignal
  onProgress?: (progress: ClientThreatEngineProgressUpdate) => void
}): Promise<RawFightEventsData> {
  const { reportId, fightId, signal, onProgress } = params
  return fetchAllRawEvents(reportId, fightId, signal, onProgress)
}

/**
 * Fetch raw event pages and process threat calculations client-side.
 */
export async function getFightEventsClientSide(params: {
  reportId: string
  fightId: number
  reportData: ReportResponse
  fightData: FightsResponse
  inferThreatReduction: boolean
  forceLegacyWorkerMode?: boolean
  rawEventChunkSize?: number
  rawEventsData?: RawFightEventsData
  signal?: AbortSignal
  onProgress?: (progress: ClientThreatEngineProgressUpdate) => void
}): Promise<AugmentedEventsResponse> {
  const {
    reportId,
    fightId,
    reportData,
    fightData,
    inferThreatReduction,
    forceLegacyWorkerMode = false,
    rawEventChunkSize,
    rawEventsData,
    signal,
    onProgress,
  } = params
  throwIfAborted(signal)
  const totalStartedAt = performance.now()

  const reportFights = reportData.fights.map(toReportFight)
  const reportActors = toReportActors(reportData.actors)
  const reportForEngine: Report = {
    code: reportData.code,
    title: reportData.title,
    owner: {
      name: reportData.owner,
    },
    visibility: reportData.visibility,
    guild: null,
    startTime: reportData.startTime,
    endTime: reportData.endTime,
    zone: reportData.zone ?? {
      id: 0,
      name: 'Unknown',
    },
    fights: reportFights,
    masterData: {
      gameVersion: reportData.gameVersion,
      actors: reportActors,
      abilities: reportData.abilities.map(toReportAbility),
    },
    rankings: null,
    archiveStatus: reportData.archiveStatus ?? null,
  }

  const {
    events: rawEvents,
    metadata,
    pageCount,
  } = rawEventsData
    ? rawEventsData
    : await fetchAllRawEvents(reportId, fightId, signal, onProgress)
  throwIfAborted(signal)
  const tankActorIds = extractTankActorIds(fightData)
  const rawChunkBuildStartedAt = performance.now()
  const rawEventChunks = chunkThreatWorkerEvents(
    rawEvents,
    resolveRawEventChunkSize(rawEventChunkSize),
  )
  const rawChunkBuildMs = Math.round(performance.now() - rawChunkBuildStartedAt)
  const workerPayloadBase = {
    fightId,
    inferThreatReduction,
    initialAurasByActor: metadata.initialAurasByActor,
    report: reportForEngine,
    tankActorIds,
  }
  const workerAttemptStats: Array<{
    inputMode: ThreatEngineWorkerPayload['inputMode']
    roundTripMs: number
    status: ThreatEngineWorkerResponse['status']
  }> = []
  const pipelineTimings: {
    cleanupMs: number | null
    fallbackMainThreadProcessMs: number | null
    indexedDbProcessedResultLoadMs: number | null
    indexedDbRawChunkPersistMs: number | null
  } = {
    cleanupMs: null,
    fallbackMainThreadProcessMs: null,
    indexedDbProcessedResultLoadMs: null,
    indexedDbRawChunkPersistMs: null,
  }
  let mode: 'worker' | 'main-thread' = 'main-thread'
  let processed: ThreatEngineWorkerProcessedPayload
  let indexedDbJobContext: {
    jobKey: string
    rawEventChunkCount: number
  } | null = null
  onProgress?.({
    phase: 'processing',
    pagesLoaded: pageCount,
    eventsLoaded: rawEvents.length,
    message: `Processing ${formatEventCount(rawEvents.length)} events`,
    mode: 'worker',
  })
  const workerAttemptStartedAt = performance.now()
  try {
    const workerRequestId = createWorkerRequestId()
    const indexedDbJobKey = buildThreatWorkerJobKey({
      reportId,
      fightId,
      requestId: workerRequestId,
    })
    const indexedDbRawChunkPersistStartedAt = performance.now()
    const persistedRawChunks = forceLegacyWorkerMode
      ? null
      : await saveThreatWorkerRawEventChunks({
          jobKey: indexedDbJobKey,
          rawEventChunks: rawEventChunks.map((chunk) => [...chunk]),
        })
    if (!forceLegacyWorkerMode) {
      pipelineTimings.indexedDbRawChunkPersistMs = Math.round(
        performance.now() - indexedDbRawChunkPersistStartedAt,
      )
    }
    throwIfAborted(signal)

    if (persistedRawChunks) {
      indexedDbJobContext = {
        jobKey: indexedDbJobKey,
        rawEventChunkCount: persistedRawChunks.rawEventChunkCount,
      }
      if (persistedRawChunks.rawEventCount !== rawEvents.length) {
        console.warn(
          '[Events] IndexedDB raw chunk persistence count mismatch',
          {
            fightId,
            persistedRawEventCount: persistedRawChunks.rawEventCount,
            rawEventCount: rawEvents.length,
            reportId,
          },
        )
      }
    } else {
      console.info(
        forceLegacyWorkerMode
          ? '[Events] Legacy worker mode forced, skipping IndexedDB worker path'
          : '[Events] IndexedDB worker path unavailable, using direct worker transfer',
        {
          fightId,
          forceLegacyWorkerMode,
          rawEventChunkCount: rawEventChunks.length,
          reportId,
        },
      )
    }

    const workerPayload: ThreatEngineWorkerPayload = indexedDbJobContext
      ? {
          ...workerPayloadBase,
          inputMode: 'indexeddb',
          jobKey: indexedDbJobContext.jobKey,
          rawEventChunkCount: indexedDbJobContext.rawEventChunkCount,
          rawEventCount: rawEvents.length,
        }
      : {
          ...workerPayloadBase,
          inputMode: 'direct',
          rawEvents,
        }

    const runWorkerAndThrowOnError = async (
      payload: ThreatEngineWorkerPayload,
    ): Promise<ThreatEngineWorkerSuccessResponse> => {
      const workerRequestStartedAt = performance.now()
      const response = await runThreatEngineWorker(payload, signal)
      workerAttemptStats.push({
        inputMode: payload.inputMode,
        roundTripMs: Math.round(performance.now() - workerRequestStartedAt),
        status: response.status,
      })
      if (response.status === 'error') {
        console.warn('[Events] Threat worker returned error response', {
          debug: response.debug,
          error: response.error,
          errorName: response.errorName,
          errorStack: response.errorStack,
          fightId,
          reportId,
        })

        throw new Error(
          `Threat worker returned status=error: ${response.errorName ?? 'Error'}: ${response.error}`,
        )
      }

      return response
    }

    let workerResponse: ThreatEngineWorkerSuccessResponse
    try {
      workerResponse = await runWorkerAndThrowOnError(workerPayload)
    } catch (error) {
      const shouldRetryWithDirectMode =
        workerPayload.inputMode === 'indexeddb' && isIndexedDbWorkerError(error)
      if (!shouldRetryWithDirectMode) {
        throw error
      }

      console.info(
        '[Events] IndexedDB worker request failed, retrying with direct worker transfer',
        {
          error: toErrorDetails(error),
          fightId,
          reportId,
        },
      )
      workerResponse = await runWorkerAndThrowOnError({
        ...workerPayloadBase,
        inputMode: 'direct',
        rawEvents,
      })
    }

    mode = 'worker'
    if (workerResponse.outputMode === 'inline') {
      processed = workerResponse.payload
    } else {
      const indexedDbProcessedResultLoadStartedAt = performance.now()
      const persistedProcessedResult = await loadThreatWorkerProcessedResult(
        workerResponse.jobKey,
      )
      pipelineTimings.indexedDbProcessedResultLoadMs = Math.round(
        performance.now() - indexedDbProcessedResultLoadStartedAt,
      )
      if (!persistedProcessedResult) {
        console.warn(
          '[Events] IndexedDB worker output missing, retrying with direct worker transfer',
          {
            fightId,
            jobKey: workerResponse.jobKey,
            reportId,
          },
        )
        const directWorkerResponse = await runWorkerAndThrowOnError({
          ...workerPayloadBase,
          inputMode: 'direct',
          rawEvents,
        })
        if (directWorkerResponse.outputMode !== 'inline') {
          throw new Error(
            'direct worker mode returned non-inline output payload',
          )
        }

        processed = directWorkerResponse.payload
      } else {
        processed = persistedProcessedResult
      }
    }
  } catch (error) {
    throwIfAborted(signal)
    console.warn(
      '[Events] Worker threat processing failed, falling back to main thread',
      {
        error: toErrorDetails(error),
        fallbackMode: 'main-thread',
        fightId,
        rawEventCount: rawEvents.length,
        reportId,
        workerAttemptElapsedMs: Math.round(
          performance.now() - workerAttemptStartedAt,
        ),
      },
    )
    const fallbackMainThreadStartedAt = performance.now()
    processed = processThreatEventsOnMainThread({
      ...workerPayloadBase,
      rawEvents,
    })
    pipelineTimings.fallbackMainThreadProcessMs = Math.round(
      performance.now() - fallbackMainThreadStartedAt,
    )
  } finally {
    if (indexedDbJobContext) {
      const cleanupStartedAt = performance.now()
      await clearThreatWorkerJobRecords({
        jobKey: indexedDbJobContext.jobKey,
        rawEventChunkCount: indexedDbJobContext.rawEventChunkCount,
      })
      pipelineTimings.cleanupMs = Math.round(
        performance.now() - cleanupStartedAt,
      )
    }
  }

  console.info('[Events] Threat processing completed', {
    fightId,
    mode,
    processDurationMs: processed.processDurationMs,
    reportId,
  })
  console.info('[Events][Perf] Threat processing pipeline timings', {
    cleanupMs: pipelineTimings.cleanupMs,
    fallbackMainThreadProcessMs: pipelineTimings.fallbackMainThreadProcessMs,
    fightId,
    forceLegacyWorkerMode,
    indexedDbProcessedResultLoadMs:
      pipelineTimings.indexedDbProcessedResultLoadMs,
    indexedDbRawChunkPersistMs: pipelineTimings.indexedDbRawChunkPersistMs,
    mode,
    pageCount,
    processDurationMs: processed.processDurationMs,
    rawChunkBuildMs,
    rawEventChunkCount: rawEventChunks.length,
    rawEventCount: rawEvents.length,
    reportId,
    totalElapsedMs: Math.round(performance.now() - totalStartedAt),
    workerAttemptElapsedMs: Math.round(
      performance.now() - workerAttemptStartedAt,
    ),
    workerAttemptStats,
  })
  onProgress?.({
    phase: 'complete',
    pagesLoaded: pageCount,
    eventsLoaded: rawEvents.length,
    message: `Processed ${formatEventCount(rawEvents.length)} events`,
    mode,
  })

  return {
    reportCode: metadata.reportCode,
    fightId: metadata.fightId,
    fightName: metadata.fightName,
    gameVersion: metadata.gameVersion,
    configVersion: metadata.configVersion,
    events: processed.augmentedEvents,
    initialAurasByActor: processed.initialAurasByActor,
  }
}
