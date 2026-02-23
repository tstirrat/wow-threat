/**
 * Tests for AuthStore bridge code cleanup and consumption behavior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockBindings } from '../../test/setup'
import { AuthStore } from './auth-store'
import type {
  FirestoreClient,
  FirestoreDocument,
  FirestoreValue,
} from './firestore-client'

function stringField(value: string): FirestoreValue {
  return {
    stringValue: value,
  }
}

function integerField(value: number): FirestoreValue {
  return {
    integerValue: String(Math.trunc(value)),
  }
}

function booleanField(value: boolean): FirestoreValue {
  return {
    booleanValue: value,
  }
}

function createBridgeDocument(
  expiresAtMs: number,
  used: boolean,
): FirestoreDocument {
  return {
    fields: {
      expiresAtMs: integerField(expiresAtMs),
      uid: stringField('uid-1'),
      used: booleanField(used),
      wclUserId: stringField('wcl-1'),
      wclUserName: stringField('WclUser'),
    },
    updateTime: 'update-time-1',
  }
}

function createMockFirestoreClient() {
  return {
    deleteDocument: vi.fn(async () => {}),
    getDocument: vi.fn(async () => null as FirestoreDocument | null),
    patchDocument: vi.fn(async () => null as FirestoreDocument | null),
    queryDocumentIdsByIntegerField: vi.fn(async () => [] as string[]),
  }
}

describe('AuthStore', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cleans expired bridge codes before consuming a valid code', async () => {
    const nowMs = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(nowMs)

    const firestoreClient = createMockFirestoreClient()
    firestoreClient.queryDocumentIdsByIntegerField.mockResolvedValue([
      'expired-1',
      'expired-2',
    ])
    firestoreClient.getDocument.mockResolvedValue(
      createBridgeDocument(nowMs + 60_000, false),
    )
    firestoreClient.patchDocument.mockResolvedValue({
      updateTime: 'update-time-2',
    })

    const store = new AuthStore(
      createMockBindings(),
      firestoreClient as unknown as FirestoreClient,
    )
    const payload = await store.consumeBridgeCode('active-code')

    expect(payload).toEqual({
      uid: 'uid-1',
      wclUserId: 'wcl-1',
      wclUserName: 'WclUser',
    })
    expect(firestoreClient.queryDocumentIdsByIntegerField).toHaveBeenCalledWith(
      'wcl_bridge_codes',
      'expiresAtMs',
      nowMs,
      25,
    )
    expect(firestoreClient.deleteDocument).toHaveBeenCalledTimes(2)
    expect(firestoreClient.deleteDocument).toHaveBeenCalledWith(
      'wcl_bridge_codes',
      'expired-1',
    )
    expect(firestoreClient.deleteDocument).toHaveBeenCalledWith(
      'wcl_bridge_codes',
      'expired-2',
    )
    expect(firestoreClient.patchDocument).toHaveBeenCalledWith(
      'wcl_bridge_codes',
      'active-code',
      expect.objectContaining({
        used: {
          booleanValue: true,
        },
      }),
      {
        currentUpdateTime: 'update-time-1',
        updateMask: ['updatedAt', 'used', 'usedAt'],
      },
    )
  })

  it('continues bridge code consumption when cleanup fails', async () => {
    const nowMs = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(nowMs)

    const firestoreClient = createMockFirestoreClient()
    firestoreClient.queryDocumentIdsByIntegerField.mockRejectedValue(
      new Error('cleanup failed'),
    )
    firestoreClient.getDocument.mockResolvedValue(
      createBridgeDocument(nowMs + 60_000, false),
    )
    firestoreClient.patchDocument.mockResolvedValue({
      updateTime: 'update-time-2',
    })

    const store = new AuthStore(
      createMockBindings(),
      firestoreClient as unknown as FirestoreClient,
    )
    const payload = await store.consumeBridgeCode('active-code')

    expect(payload).toEqual({
      uid: 'uid-1',
      wclUserId: 'wcl-1',
      wclUserName: 'WclUser',
    })
    expect(warnSpy).toHaveBeenCalledWith(
      '[AuthStore] Failed to cleanup expired bridge codes',
      expect.objectContaining({
        error: expect.any(Error),
      }),
    )
    expect(firestoreClient.patchDocument).toHaveBeenCalledTimes(1)
  })

  it('returns null for expired bridge codes', async () => {
    const nowMs = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(nowMs)

    const firestoreClient = createMockFirestoreClient()
    firestoreClient.getDocument.mockResolvedValue(
      createBridgeDocument(nowMs - 1, false),
    )

    const store = new AuthStore(
      createMockBindings(),
      firestoreClient as unknown as FirestoreClient,
    )
    const payload = await store.consumeBridgeCode('expired-code')

    expect(payload).toBeNull()
    expect(firestoreClient.patchDocument).not.toHaveBeenCalled()
  })
})
