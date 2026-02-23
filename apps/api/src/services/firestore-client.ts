/**
 * Typed Firestore REST gateway for worker-compatible server operations.
 */
import { SignJWT, importPKCS8 } from 'jose'

import { firestoreError } from '../middleware/error'
import type { Bindings } from '../types/bindings'

const FIRESTORE_TOKEN_SCOPE = 'https://www.googleapis.com/auth/datastore'
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'

interface GoogleOAuthTokenResponse {
  access_token: string
  expires_in: number
}

interface FirestoreAccessTokenCacheEntry {
  accessToken: string
  expiresAt: number
}

export interface FirestoreDocument {
  fields?: Record<string, FirestoreValue>
  updateTime?: string
}

export type FirestoreValue =
  | { booleanValue: boolean }
  | { integerValue: string }
  | { nullValue: null }
  | { stringValue: string }
  | { timestampValue: string }

export interface FirestorePatchOptions {
  currentUpdateTime?: string
  updateMask?: string[]
}

interface FirestoreRunQueryResponse {
  document?: {
    name?: string
  }
}

function parseFirestoreErrorMessage(body: string): string {
  if (!body) {
    return 'Unknown Firestore API error'
  }

  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown; status?: unknown }
    }
    if (typeof parsed.error?.message === 'string') {
      return parsed.error.message
    }
  } catch {
    // Fall back to raw body.
  }

  return body
}

/** Firestore REST client for worker runtime. */
export class FirestoreClient {
  private readonly env: Bindings
  private readonly firestoreBaseUrl: string
  private accessTokenCache: FirestoreAccessTokenCacheEntry | null = null
  private privateKeyPromise: Promise<CryptoKey> | null = null

  constructor(env: Bindings) {
    this.env = env
    this.firestoreBaseUrl = `https://firestore.googleapis.com/v1/projects/${env.FIRESTORE_PROJECT_ID}/databases/(default)/documents`
  }

  /** Read a Firestore document or return null when absent. */
  async getDocument(
    collection: string,
    docId: string,
  ): Promise<FirestoreDocument | null> {
    const path = this.buildDocumentPath(collection, docId)
    const response = await this.firestoreFetch(path, {
      method: 'GET',
    })

    if (response.status === 404) {
      return null
    }
    if (!response.ok) {
      const body = await response.text()
      throw firestoreError(
        `Failed to read Firestore document: ${parseFirestoreErrorMessage(body)}`,
      )
    }

    return (await response.json()) as FirestoreDocument
  }

  /** Delete a Firestore document if present. */
  async deleteDocument(collection: string, docId: string): Promise<void> {
    const path = this.buildDocumentPath(collection, docId)
    const response = await this.firestoreFetch(path, {
      method: 'DELETE',
    })

    if (response.status === 404) {
      return
    }
    if (!response.ok) {
      const body = await response.text()
      throw firestoreError(
        `Failed to delete Firestore document: ${parseFirestoreErrorMessage(body)}`,
      )
    }
  }

  /**
   * Patch a Firestore document and optionally enforce update preconditions.
   * Returns null when a write precondition fails.
   */
  async patchDocument(
    collection: string,
    docId: string,
    fields: Record<string, FirestoreValue>,
    options: FirestorePatchOptions = {},
  ): Promise<FirestoreDocument | null> {
    const searchParams = new URLSearchParams()
    options.updateMask?.forEach((fieldPath) => {
      searchParams.append('updateMask.fieldPaths', fieldPath)
    })
    if (options.currentUpdateTime) {
      searchParams.set('currentDocument.updateTime', options.currentUpdateTime)
    }

    const query = searchParams.toString()
    const path = `${this.buildDocumentPath(collection, docId)}${query ? `?${query}` : ''}`
    const response = await this.firestoreFetch(path, {
      body: JSON.stringify({
        fields,
      }),
      method: 'PATCH',
    })

    if (response.status === 409 || response.status === 412) {
      return null
    }
    if (!response.ok) {
      const body = await response.text()
      throw firestoreError(
        `Failed to write Firestore document: ${parseFirestoreErrorMessage(body)}`,
      )
    }

    return (await response.json()) as FirestoreDocument
  }

  /**
   * Query document ids in a collection where an integer field is <= a value.
   */
  async queryDocumentIdsByIntegerField(
    collection: string,
    fieldPath: string,
    maxValue: number,
    limit: number,
  ): Promise<string[]> {
    const response = await this.firestoreFetch(':runQuery', {
      body: JSON.stringify({
        structuredQuery: {
          from: [
            {
              collectionId: collection,
            },
          ],
          limit,
          orderBy: [
            {
              direction: 'ASCENDING',
              field: {
                fieldPath,
              },
            },
          ],
          where: {
            fieldFilter: {
              field: {
                fieldPath,
              },
              op: 'LESS_THAN_OR_EQUAL',
              value: {
                integerValue: String(Math.trunc(maxValue)),
              },
            },
          },
        },
      }),
      method: 'POST',
    })

    if (!response.ok) {
      const body = await response.text()
      throw firestoreError(
        `Failed to query Firestore documents: ${parseFirestoreErrorMessage(body)}`,
      )
    }

    const payload = (await response.json()) as FirestoreRunQueryResponse[]

    return payload
      .map((entry) => entry.document?.name)
      .filter((name): name is string => typeof name === 'string')
      .map((name) => {
        const separatorIndex = name.lastIndexOf('/')
        return separatorIndex >= 0 ? name.slice(separatorIndex + 1) : name
      })
      .filter((docId) => docId.length > 0)
  }

  private async getGoogleAccessToken(): Promise<string> {
    if (this.env.ENVIRONMENT === 'test') {
      return 'test-google-access-token'
    }

    if (
      this.accessTokenCache &&
      this.accessTokenCache.expiresAt > Date.now() + 60_000
    ) {
      return this.accessTokenCache.accessToken
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    const privateKey = await this.getPrivateKey()
    const assertion = await new SignJWT({
      scope: FIRESTORE_TOKEN_SCOPE,
    })
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'JWT',
      })
      .setAudience(GOOGLE_OAUTH_TOKEN_URL)
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + 3600)
      .setIssuer(this.env.FIREBASE_CLIENT_EMAIL)
      .setSubject(this.env.FIREBASE_CLIENT_EMAIL)
      .sign(privateKey)

    const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      body: new URLSearchParams({
        assertion,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    })

    if (!response.ok) {
      throw firestoreError(
        'Unable to authenticate with Firestore service account',
      )
    }

    const payload = (await response.json()) as GoogleOAuthTokenResponse
    this.accessTokenCache = {
      accessToken: payload.access_token,
      expiresAt: Date.now() + payload.expires_in * 1000,
    }

    return payload.access_token
  }

  private async getPrivateKey(): Promise<CryptoKey> {
    if (!this.privateKeyPromise) {
      const pem = this.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      this.privateKeyPromise = importPKCS8(pem, 'RS256')
    }

    return this.privateKeyPromise
  }

  private buildDocumentPath(collection: string, docId: string): string {
    const encodedCollection = encodeURIComponent(collection)
    const encodedDocId = encodeURIComponent(docId)
    return `${encodedCollection}/${encodedDocId}`
  }

  private async firestoreFetch(
    relativePath: string,
    init: RequestInit,
  ): Promise<Response> {
    const accessToken = await this.getGoogleAccessToken()
    const url = relativePath.startsWith(':')
      ? `${this.firestoreBaseUrl}${relativePath}`
      : `${this.firestoreBaseUrl}/${relativePath}`
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('Content-Type', 'application/json')

    return fetch(url, {
      ...init,
      headers,
    })
  }
}
