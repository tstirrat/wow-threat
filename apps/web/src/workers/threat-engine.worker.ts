/**
 * Dedicated worker for threat engine event processing.
 */
import { resolveConfigOrNull } from '@wow-threat/config'
import { ThreatEngine, buildThreatEngineInput } from '@wow-threat/engine'
import type { WCLEvent } from '@wow-threat/wcl-types'

import {
  loadThreatWorkerRawEventChunks,
  saveThreatWorkerProcessedResult,
} from '../lib/threat-engine-worker-cache'
import type {
  ThreatEngineWorkerPayload,
  ThreatEngineWorkerProcessedPayload,
  ThreatEngineWorkerRequest,
  ThreatEngineWorkerResponse,
} from './threat-engine-worker-types'

const threatEngine = new ThreatEngine()

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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function toErrorName(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.name
  }

  return undefined
}

function toErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack
  }

  return undefined
}

async function getRawEvents(
  payload: ThreatEngineWorkerPayload,
): Promise<WCLEvent[]> {
  if (payload.inputMode === 'direct') {
    return payload.rawEvents
  }

  const chunkedEvents = await loadThreatWorkerRawEventChunks({
    jobKey: payload.jobKey,
    rawEventChunkCount: payload.rawEventChunkCount,
  })
  if (!chunkedEvents) {
    throw new Error(
      `unable to load indexeddb worker chunks for ${payload.jobKey} (${payload.rawEventChunkCount} chunks)`,
    )
  }

  if (chunkedEvents.length !== payload.rawEventCount) {
    console.warn('[ThreatWorker] IndexedDB chunk count mismatch', {
      expectedRawEventCount: payload.rawEventCount,
      jobKey: payload.jobKey,
      loadedRawEventCount: chunkedEvents.length,
      rawEventChunkCount: payload.rawEventChunkCount,
    })
  }

  return chunkedEvents
}

const workerContext = self as unknown as DedicatedWorkerGlobalScope

workerContext.onmessage = (
  message: MessageEvent<ThreatEngineWorkerRequest>,
): void => {
  void (async () => {
    const startedAt = performance.now()
    const { payload, requestId } = message.data
    const expectedRawEventCount =
      payload.inputMode === 'direct'
        ? payload.rawEvents.length
        : payload.rawEventCount
    let rawEventCount = expectedRawEventCount

    console.info('[ThreatWorker] Received request', {
      fightId: payload.fightId,
      inferThreatReduction: payload.inferThreatReduction,
      inputMode: payload.inputMode,
      rawEventCount: expectedRawEventCount,
      reportCode: payload.report.code,
      requestId,
    })

    try {
      const rawEvents = await getRawEvents(payload)
      rawEventCount = rawEvents.length

      const fight = payload.report.fights.find(
        (candidateFight) => candidateFight.id === payload.fightId,
      )
      if (!fight) {
        throw new Error(`fight ${payload.fightId} not found in report payload`)
      }

      const config = resolveConfigOrNull({
        report: payload.report,
      })
      if (!config) {
        throw new Error(
          `no threat config for gameVersion ${payload.report.masterData.gameVersion}`,
        )
      }

      const initialAurasByActor = deserializeInitialAurasByActor(
        payload.initialAurasByActor,
      )
      const { actorMap, friendlyActorIds, enemies, abilitySchoolMap } =
        buildThreatEngineInput({
          fight,
          actors: payload.report.masterData.actors,
          abilities: payload.report.masterData.abilities,
        })

      const {
        augmentedEvents,
        initialAurasByActor: effectiveInitialAurasByActor,
      } = threatEngine.processEvents({
        rawEvents,
        initialAurasByActor,
        actorMap,
        friendlyActorIds,
        abilitySchoolMap,
        enemies,
        encounterId: fight.encounterID ?? null,
        report: payload.report,
        fight,
        inferThreatReduction: payload.inferThreatReduction,
        tankActorIds: new Set(payload.tankActorIds),
        config,
      })

      const processDurationMs = Math.round(performance.now() - startedAt)
      const processedPayload: ThreatEngineWorkerProcessedPayload = {
        augmentedEvents,
        initialAurasByActor: serializeInitialAurasByActor(
          effectiveInitialAurasByActor,
        ),
        processDurationMs,
      }

      if (payload.inputMode === 'indexeddb') {
        const didSaveProcessedResult = await saveThreatWorkerProcessedResult({
          jobKey: payload.jobKey,
          payload: processedPayload,
        })
        if (!didSaveProcessedResult) {
          throw new Error(
            `unable to persist indexeddb worker output for ${payload.jobKey}`,
          )
        }

        const response: ThreatEngineWorkerResponse = {
          requestId,
          status: 'success',
          outputMode: 'indexeddb',
          jobKey: payload.jobKey,
          rawEventChunkCount: payload.rawEventChunkCount,
          rawEventCount,
          debug: {
            processDurationMs,
            rawEventCount,
            augmentedEventCount: augmentedEvents.length,
          },
        }

        console.info('[ThreatWorker] Completed indexeddb request', {
          ...response.debug,
          requestId,
        })
        workerContext.postMessage(response)
        return
      }

      const response: ThreatEngineWorkerResponse = {
        requestId,
        status: 'success',
        outputMode: 'inline',
        debug: {
          processDurationMs,
          rawEventCount,
          augmentedEventCount: augmentedEvents.length,
        },
        payload: processedPayload,
      }

      console.info('[ThreatWorker] Completed inline request', {
        ...response.debug,
        requestId,
      })
      workerContext.postMessage(response)
    } catch (error) {
      const response: ThreatEngineWorkerResponse = {
        requestId,
        status: 'error',
        error: toErrorMessage(error),
        errorName: toErrorName(error),
        errorStack: toErrorStack(error),
        debug: {
          processDurationMs: Math.round(performance.now() - startedAt),
          rawEventCount,
        },
      }
      console.warn('[ThreatWorker] Failed request', {
        ...response.debug,
        error: response.error,
        errorName: response.errorName,
        requestId,
      })
      workerContext.postMessage(response)
    }
  })()
}

export {}
