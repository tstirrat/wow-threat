/**
 * Unit tests for client threat processing worker orchestration fallbacks.
 */
import { createDamageEvent } from '@wow-threat/shared'
import type { WCLEvent } from '@wow-threat/wcl-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  FightsResponse,
  ReportAbilitySummary,
  ReportActorSummary,
  ReportFightSummary,
  ReportResponse,
} from '../types/api'
import type {
  ThreatEngineWorkerRequest,
  ThreatEngineWorkerResponse,
} from '../workers/threat-engine-worker-types'
import {
  type RawFightEventsData,
  getFightEventsClientSide,
} from './client-threat-engine'

interface ThreatWorkerRawChunkWriteResult {
  rawEventChunkCount: number
  rawEventCount: number
}

type MockWorkerDispatchResult =
  | {
      type: 'error'
      message: string
    }
  | {
      type: 'message'
      response: ThreatEngineWorkerResponse
    }

type WorkerMessageListener = (
  event: MessageEvent<ThreatEngineWorkerResponse>,
) => void
type WorkerErrorListener = (event: ErrorEvent) => void
type WorkerMessageErrorListener = (event: MessageEvent) => void

const mockFns = vi.hoisted(() => ({
  clearThreatWorkerJobRecords:
    vi.fn<
      (params: { jobKey: string; rawEventChunkCount: number }) => Promise<void>
    >(),
  loadThreatWorkerProcessedResult: vi.fn<
    (jobKey: string) => Promise<{
      augmentedEvents: ReturnType<typeof createDamageEvent>[]
      initialAurasByActor: Record<string, number[]>
      processDurationMs: number
    } | null>
  >(),
  runWorkerRequest:
    vi.fn<
      (
        request: ThreatEngineWorkerRequest,
      ) => Promise<MockWorkerDispatchResult> | MockWorkerDispatchResult
    >(),
  saveThreatWorkerRawEventChunks:
    vi.fn<
      (params: {
        jobKey: string
        rawEventChunks: WCLEvent[][]
      }) => Promise<ThreatWorkerRawChunkWriteResult | null>
    >(),
}))

vi.mock('./threat-engine-worker-cache', async () => {
  const actual = await vi.importActual<
    typeof import('./threat-engine-worker-cache')
  >('./threat-engine-worker-cache')

  return {
    ...actual,
    clearThreatWorkerJobRecords: mockFns.clearThreatWorkerJobRecords,
    loadThreatWorkerProcessedResult: mockFns.loadThreatWorkerProcessedResult,
    saveThreatWorkerRawEventChunks: mockFns.saveThreatWorkerRawEventChunks,
  }
})

class WorkerMock {
  private readonly messageListeners = new Set<WorkerMessageListener>()
  private readonly errorListeners = new Set<WorkerErrorListener>()
  private readonly messageErrorListeners = new Set<WorkerMessageErrorListener>()

  addEventListener(type: 'message', listener: WorkerMessageListener): void
  addEventListener(type: 'error', listener: WorkerErrorListener): void
  addEventListener(
    type: 'messageerror',
    listener: WorkerMessageErrorListener,
  ): void
  addEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener:
      | WorkerMessageListener
      | WorkerErrorListener
      | WorkerMessageErrorListener,
  ): void {
    if (type === 'message') {
      this.messageListeners.add(listener as WorkerMessageListener)
      return
    }

    if (type === 'error') {
      this.errorListeners.add(listener as WorkerErrorListener)
      return
    }

    this.messageErrorListeners.add(listener as WorkerMessageErrorListener)
  }

  removeEventListener(type: 'message', listener: WorkerMessageListener): void
  removeEventListener(type: 'error', listener: WorkerErrorListener): void
  removeEventListener(
    type: 'messageerror',
    listener: WorkerMessageErrorListener,
  ): void
  removeEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener:
      | WorkerMessageListener
      | WorkerErrorListener
      | WorkerMessageErrorListener,
  ): void {
    if (type === 'message') {
      this.messageListeners.delete(listener as WorkerMessageListener)
      return
    }

    if (type === 'error') {
      this.errorListeners.delete(listener as WorkerErrorListener)
      return
    }

    this.messageErrorListeners.delete(listener as WorkerMessageErrorListener)
  }

  postMessage(request: ThreatEngineWorkerRequest): void {
    void Promise.resolve()
      .then(() => mockFns.runWorkerRequest(request))
      .then((result) => {
        if (result.type === 'error') {
          const errorEvent = {
            message: result.message,
          } as ErrorEvent
          this.errorListeners.forEach((listener) => {
            listener(errorEvent)
          })
          return
        }

        const messageEvent = {
          data: result.response,
        } as MessageEvent<ThreatEngineWorkerResponse>
        this.messageListeners.forEach((listener) => {
          listener(messageEvent)
        })
      })
      .catch((error) => {
        const errorEvent = {
          message: error instanceof Error ? error.message : String(error),
        } as ErrorEvent
        this.errorListeners.forEach((listener) => {
          listener(errorEvent)
        })
      })
  }

  terminate(): void {}
}

function createReportActor(
  overrides: Partial<ReportActorSummary> = {},
): ReportActorSummary {
  return {
    id: 1,
    gameID: 1,
    name: 'Aegistank',
    type: 'Player',
    subType: 'Warrior',
    role: 'Tank',
    ...overrides,
  }
}

function createReportFight(
  overrides: Partial<ReportFightSummary> = {},
): ReportFightSummary {
  return {
    id: 26,
    encounterID: 1602,
    classicSeasonID: 3,
    name: 'Patchwerk',
    startTime: 0,
    endTime: 120_000,
    kill: true,
    difficulty: 3,
    bossPercentage: null,
    fightPercentage: null,
    enemyNPCs: [
      {
        id: 100,
        gameID: 100,
        instanceCount: 1,
        groupCount: 1,
        petOwner: null,
      },
    ],
    enemyPets: [],
    friendlyPlayers: [1],
    friendlyPets: [],
    ...overrides,
  }
}

function createReportData(): ReportResponse {
  const ability: ReportAbilitySummary = {
    gameID: 1,
    icon: null,
    name: 'Melee',
    type: 'Physical',
  }

  return {
    code: 'ABC123xyz',
    title: 'Test Report',
    visibility: 'public',
    owner: 'Tester',
    guild: null,
    archiveStatus: null,
    startTime: 0,
    endTime: 120_000,
    gameVersion: 2,
    threatConfig: null,
    zone: {
      id: 1001,
      name: 'Naxxramas',
      partitions: [],
    },
    fights: [createReportFight()],
    actors: [createReportActor()],
    abilities: [ability],
  }
}

function createFightData(): FightsResponse {
  return {
    id: 26,
    reportCode: 'ABC123xyz',
    name: 'Patchwerk',
    startTime: 0,
    endTime: 120_000,
    kill: true,
    difficulty: 3,
    enemies: [
      createReportActor({
        id: 100,
        gameID: 100,
        name: 'Patchwerk',
        type: 'NPC',
        subType: 'Boss',
        role: undefined,
      }),
    ],
    actors: [createReportActor()],
  }
}

function createRawEventsData(): RawFightEventsData {
  const event = createDamageEvent({
    sourceID: 1,
    targetID: 100,
    timestamp: 1000,
  })

  return {
    events: [event],
    metadata: {
      reportCode: 'ABC123xyz',
      fightId: 26,
      fightName: 'Patchwerk',
      gameVersion: 2,
      configVersion: 'test-config-v1',
      events: [event],
      nextPageTimestamp: null,
      initialAurasByActor: {},
    },
    pageCount: 1,
  }
}

describe('client-threat-engine worker retries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('Worker', WorkerMock as never)

    mockFns.clearThreatWorkerJobRecords.mockResolvedValue()
    mockFns.loadThreatWorkerProcessedResult.mockResolvedValue(null)
    mockFns.saveThreatWorkerRawEventChunks.mockResolvedValue({
      rawEventChunkCount: 1,
      rawEventCount: 1,
    })
  })

  it('retries indexeddb worker errors using direct worker mode before main-thread fallback', async () => {
    mockFns.runWorkerRequest
      .mockImplementationOnce(async (request) => {
        if (request.payload.inputMode !== 'indexeddb') {
          throw new Error('expected indexeddb payload for first worker request')
        }

        return {
          type: 'message',
          response: {
            requestId: request.requestId,
            status: 'error',
            error:
              'unable to load indexeddb worker chunks for ABC123xyz:26:req',
            errorName: 'Error',
          },
        }
      })
      .mockImplementationOnce(async (request) => {
        if (request.payload.inputMode !== 'direct') {
          throw new Error('expected direct payload for second worker request')
        }

        return {
          type: 'message',
          response: {
            requestId: request.requestId,
            status: 'success',
            outputMode: 'inline',
            payload: {
              augmentedEvents: [],
              initialAurasByActor: {},
              processDurationMs: 7,
            },
          },
        }
      })

    const rawEventsData = createRawEventsData()
    const result = await getFightEventsClientSide({
      reportId: 'ABC123xyz',
      fightId: 26,
      reportData: createReportData(),
      fightData: createFightData(),
      inferThreatReduction: false,
      rawEventsData,
    })

    expect(mockFns.runWorkerRequest).toHaveBeenCalledTimes(2)
    const firstRequest = mockFns.runWorkerRequest.mock.calls[0]?.[0]
    const secondRequest = mockFns.runWorkerRequest.mock.calls[1]?.[0]
    expect(firstRequest).toBeDefined()
    expect(secondRequest).toBeDefined()
    expect(firstRequest?.payload.inputMode).toBe('indexeddb')
    expect(secondRequest?.payload.inputMode).toBe('direct')

    if (secondRequest?.payload.inputMode === 'direct') {
      expect(secondRequest.payload.rawEvents).toEqual(rawEventsData.events)
    }

    expect(result.events).toEqual([])
    expect(mockFns.clearThreatWorkerJobRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        rawEventChunkCount: 1,
      }),
    )
  })

  it('retries with direct mode when indexeddb worker output cannot be loaded', async () => {
    mockFns.loadThreatWorkerProcessedResult.mockResolvedValueOnce(null)
    mockFns.runWorkerRequest
      .mockImplementationOnce(async (request) => {
        if (request.payload.inputMode !== 'indexeddb') {
          throw new Error('expected indexeddb payload for first worker request')
        }

        return {
          type: 'message',
          response: {
            jobKey: request.payload.jobKey,
            outputMode: 'indexeddb',
            rawEventChunkCount: request.payload.rawEventChunkCount,
            rawEventCount: request.payload.rawEventCount,
            requestId: request.requestId,
            status: 'success',
          },
        }
      })
      .mockImplementationOnce(async (request) => {
        if (request.payload.inputMode !== 'direct') {
          throw new Error('expected direct payload for second worker request')
        }

        return {
          type: 'message',
          response: {
            requestId: request.requestId,
            status: 'success',
            outputMode: 'inline',
            payload: {
              augmentedEvents: [],
              initialAurasByActor: {},
              processDurationMs: 3,
            },
          },
        }
      })

    const rawEventsData = createRawEventsData()
    const result = await getFightEventsClientSide({
      reportId: 'ABC123xyz',
      fightId: 26,
      reportData: createReportData(),
      fightData: createFightData(),
      inferThreatReduction: false,
      rawEventsData,
    })

    expect(mockFns.loadThreatWorkerProcessedResult).toHaveBeenCalledTimes(1)
    expect(mockFns.runWorkerRequest).toHaveBeenCalledTimes(2)
    const firstRequest = mockFns.runWorkerRequest.mock.calls[0]?.[0]
    const secondRequest = mockFns.runWorkerRequest.mock.calls[1]?.[0]
    expect(firstRequest?.payload.inputMode).toBe('indexeddb')
    expect(secondRequest?.payload.inputMode).toBe('direct')

    if (secondRequest?.payload.inputMode === 'direct') {
      expect(secondRequest.payload.rawEvents).toEqual(rawEventsData.events)
    }

    expect(result.events).toEqual([])
  })

  it('does not retry direct mode when legacy worker mode is forced', async () => {
    mockFns.runWorkerRequest.mockImplementationOnce(async (request) => {
      if (request.payload.inputMode !== 'direct') {
        throw new Error('expected direct payload for legacy worker mode')
      }

      return {
        type: 'message',
        response: {
          requestId: request.requestId,
          status: 'success',
          outputMode: 'inline',
          payload: {
            augmentedEvents: [],
            initialAurasByActor: {},
            processDurationMs: 5,
          },
        },
      }
    })

    await getFightEventsClientSide({
      reportId: 'ABC123xyz',
      fightId: 26,
      reportData: createReportData(),
      fightData: createFightData(),
      inferThreatReduction: false,
      forceLegacyWorkerMode: true,
      rawEventsData: createRawEventsData(),
    })

    expect(mockFns.runWorkerRequest).toHaveBeenCalledTimes(1)
    const firstRequest = mockFns.runWorkerRequest.mock.calls[0]?.[0]
    expect(firstRequest?.payload.inputMode).toBe('direct')
    expect(mockFns.saveThreatWorkerRawEventChunks).not.toHaveBeenCalled()
    expect(mockFns.clearThreatWorkerJobRecords).not.toHaveBeenCalled()
  })
})
