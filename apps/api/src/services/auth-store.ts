/**
 * Firestore-backed storage for WCL auth tokens and bridge codes.
 */
import type { Bindings } from '../types/bindings'
import {
  FirestoreClient,
  type FirestoreDocument,
  type FirestoreValue,
} from './firestore-client'
import {
  createRandomBase64Url,
  decryptSecret,
  encryptSecret,
  importAesGcmKey,
} from './token-utils'

const WCL_TOKENS_COLLECTION = 'wcl_auth_tokens'
const BRIDGE_CODES_COLLECTION = 'wcl_bridge_codes'

export interface StoredWclTokenRecord {
  accessToken: string
  accessTokenExpiresAtMs: number
  refreshToken: string | null
  refreshTokenExpiresAtMs: number | null
  tokenType: string
  uid: string
  wclUserId: string
  wclUserName: string
}

export interface SaveWclTokenRecordInput {
  accessToken: string
  accessTokenExpiresAtMs: number
  refreshToken: string | null
  refreshTokenExpiresAtMs: number | null
  tokenType: string
  uid: string
  wclUserId: string
  wclUserName: string
}

export interface BridgeCodePayload {
  uid: string
  wclUserId: string
  wclUserName: string
}

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

function timestampField(value: string): FirestoreValue {
  return {
    timestampValue: value,
  }
}

function nullField(): FirestoreValue {
  return {
    nullValue: null,
  }
}

function readStringField(
  fields: Record<string, FirestoreValue>,
  key: string,
): string {
  const field = fields[key]
  if (!field || !('stringValue' in field)) {
    throw new Error(`Missing string field: ${key}`)
  }

  return field.stringValue
}

function readOptionalStringField(
  fields: Record<string, FirestoreValue>,
  key: string,
): string | null {
  const field = fields[key]
  if (!field) {
    return null
  }

  if ('nullValue' in field) {
    return null
  }
  if (!('stringValue' in field)) {
    throw new Error(`Invalid optional string field: ${key}`)
  }

  return field.stringValue
}

function readIntegerField(
  fields: Record<string, FirestoreValue>,
  key: string,
): number {
  const field = fields[key]
  if (!field || !('integerValue' in field)) {
    throw new Error(`Missing integer field: ${key}`)
  }

  const value = Number.parseInt(field.integerValue, 10)
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid integer field: ${key}`)
  }

  return value
}

function readOptionalIntegerField(
  fields: Record<string, FirestoreValue>,
  key: string,
): number | null {
  const field = fields[key]
  if (!field) {
    return null
  }

  if ('nullValue' in field) {
    return null
  }
  if (!('integerValue' in field)) {
    throw new Error(`Invalid optional integer field: ${key}`)
  }

  const value = Number.parseInt(field.integerValue, 10)
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid optional integer field: ${key}`)
  }

  return value
}

function readBooleanField(
  fields: Record<string, FirestoreValue>,
  key: string,
): boolean {
  const field = fields[key]
  if (!field || !('booleanValue' in field)) {
    throw new Error(`Missing boolean field: ${key}`)
  }

  return field.booleanValue
}

/** Firestore-backed store for WCL OAuth tokens and bridge code state. */
export class AuthStore {
  private readonly firestoreClient: FirestoreClient
  private readonly env: Bindings
  private encryptionKeyPromise: Promise<CryptoKey> | null = null

  constructor(env: Bindings, firestoreClient?: FirestoreClient) {
    this.env = env
    this.firestoreClient = firestoreClient ?? new FirestoreClient(env)
  }

  /** Persist encrypted WCL OAuth tokens for a Firebase uid. */
  async saveWclTokens(input: SaveWclTokenRecordInput): Promise<void> {
    const key = await this.getEncryptionKey()
    const nowIso = new Date().toISOString()
    const encryptedAccessToken = await encryptSecret(input.accessToken, key)
    const encryptedRefreshToken = input.refreshToken
      ? await encryptSecret(input.refreshToken, key)
      : null

    await this.firestoreClient.patchDocument(WCL_TOKENS_COLLECTION, input.uid, {
      accessToken: stringField(encryptedAccessToken),
      accessTokenExpiresAtMs: integerField(input.accessTokenExpiresAtMs),
      createdAt: timestampField(nowIso),
      refreshToken: encryptedRefreshToken
        ? stringField(encryptedRefreshToken)
        : nullField(),
      refreshTokenExpiresAtMs:
        input.refreshTokenExpiresAtMs != null
          ? integerField(input.refreshTokenExpiresAtMs)
          : nullField(),
      tokenType: stringField(input.tokenType),
      uid: stringField(input.uid),
      updatedAt: timestampField(nowIso),
      wclUserId: stringField(input.wclUserId),
      wclUserName: stringField(input.wclUserName),
    })
  }

  /** Load and decrypt WCL OAuth tokens for a Firebase uid. */
  async getWclTokens(uid: string): Promise<StoredWclTokenRecord | null> {
    const document = await this.firestoreClient.getDocument(
      WCL_TOKENS_COLLECTION,
      uid,
    )
    if (!document?.fields) {
      return null
    }

    const key = await this.getEncryptionKey()
    const encryptedAccessToken = readStringField(document.fields, 'accessToken')
    const encryptedRefreshToken = readOptionalStringField(
      document.fields,
      'refreshToken',
    )

    const accessToken = await decryptSecret(encryptedAccessToken, key)
    const refreshToken = encryptedRefreshToken
      ? await decryptSecret(encryptedRefreshToken, key)
      : null

    return {
      accessToken,
      accessTokenExpiresAtMs: readIntegerField(
        document.fields,
        'accessTokenExpiresAtMs',
      ),
      refreshToken,
      refreshTokenExpiresAtMs: readOptionalIntegerField(
        document.fields,
        'refreshTokenExpiresAtMs',
      ),
      tokenType: readStringField(document.fields, 'tokenType'),
      uid: readStringField(document.fields, 'uid'),
      wclUserId: readStringField(document.fields, 'wclUserId'),
      wclUserName: readStringField(document.fields, 'wclUserName'),
    }
  }

  /** Delete stored WCL tokens for a Firebase uid. */
  async deleteWclTokens(uid: string): Promise<void> {
    await this.firestoreClient.deleteDocument(WCL_TOKENS_COLLECTION, uid)
  }

  /** Create a one-time bridge code with Firestore-backed single-use state. */
  async createBridgeCode(
    payload: BridgeCodePayload,
    ttlSeconds = 300,
  ): Promise<string> {
    const code = createRandomBase64Url(32)
    const nowIso = new Date().toISOString()
    const expiresAtMs = Date.now() + ttlSeconds * 1000

    await this.firestoreClient.patchDocument(BRIDGE_CODES_COLLECTION, code, {
      createdAt: timestampField(nowIso),
      expiresAtMs: integerField(expiresAtMs),
      uid: stringField(payload.uid),
      updatedAt: timestampField(nowIso),
      used: booleanField(false),
      wclUserId: stringField(payload.wclUserId),
      wclUserName: stringField(payload.wclUserName),
    })

    return code
  }

  /** Validate and consume a bridge code exactly once. */
  async consumeBridgeCode(code: string): Promise<BridgeCodePayload | null> {
    const existing = await this.firestoreClient.getDocument(
      BRIDGE_CODES_COLLECTION,
      code,
    )
    if (!existing?.fields || !existing.updateTime) {
      return null
    }

    const expiresAtMs = readIntegerField(existing.fields, 'expiresAtMs')
    const isUsed = readBooleanField(existing.fields, 'used')
    if (isUsed || expiresAtMs <= Date.now()) {
      return null
    }

    const nowIso = new Date().toISOString()
    const updated = await this.firestoreClient.patchDocument(
      BRIDGE_CODES_COLLECTION,
      code,
      {
        updatedAt: timestampField(nowIso),
        used: booleanField(true),
        usedAt: timestampField(nowIso),
      },
      {
        currentUpdateTime: existing.updateTime,
        updateMask: ['updatedAt', 'used', 'usedAt'],
      },
    )

    if (!updated) {
      return null
    }

    return {
      uid: readStringField(existing.fields, 'uid'),
      wclUserId: readStringField(existing.fields, 'wclUserId'),
      wclUserName: readStringField(existing.fields, 'wclUserName'),
    }
  }

  private async getEncryptionKey(): Promise<CryptoKey> {
    if (!this.encryptionKeyPromise) {
      this.encryptionKeyPromise = importAesGcmKey(
        this.env.WCL_TOKEN_ENCRYPTION_KEY,
      )
    }

    return this.encryptionKeyPromise
  }
}

export type { FirestoreDocument, FirestoreValue }
