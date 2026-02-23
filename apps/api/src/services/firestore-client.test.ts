/**
 * Tests for Firestore REST client behavior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockBindings } from '../../test/setup'
import { FirestoreClient, type FirestoreValue } from './firestore-client'

interface StoredDocument {
  fields: Record<string, FirestoreValue>
  updateTime: string
}

const firestorePrefix =
  'https://firestore.googleapis.com/v1/projects/wow-threat/databases/(default)/documents/'
const firestoreRunQueryPath =
  'https://firestore.googleapis.com/v1/projects/wow-threat/databases/(default)/documents:runQuery'

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

function createMockFirestoreFetch() {
  const documents = new Map<string, StoredDocument>()

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === 'string' ? input : input.toString()
    const url = new URL(requestUrl)
    const method = init?.method ?? 'GET'

    if (requestUrl === firestoreRunQueryPath) {
      if (method !== 'POST') {
        throw new Error(`Unexpected runQuery method: ${method}`)
      }

      const body = init?.body
        ? (JSON.parse(init.body as string) as {
            structuredQuery?: {
              from?: Array<{ collectionId?: string }>
              limit?: number
              where?: {
                fieldFilter?: {
                  field?: { fieldPath?: string }
                  value?: { integerValue?: string }
                }
              }
            }
          })
        : {}
      const collectionId = body.structuredQuery?.from?.[0]?.collectionId
      const fieldPath =
        body.structuredQuery?.where?.fieldFilter?.field?.fieldPath
      const integerValue = Number.parseInt(
        body.structuredQuery?.where?.fieldFilter?.value?.integerValue ?? '',
        10,
      )
      const limit = body.structuredQuery?.limit ?? Number.MAX_SAFE_INTEGER

      const matchingDocuments = [...documents.entries()]
        .filter(([path, document]) => {
          if (!collectionId || !fieldPath || !Number.isFinite(integerValue)) {
            return false
          }
          if (!path.startsWith(`${collectionId}/`)) {
            return false
          }

          const fieldValue = document.fields[fieldPath]
          if (!fieldValue || !('integerValue' in fieldValue)) {
            return false
          }

          const numericValue = Number.parseInt(fieldValue.integerValue, 10)
          return Number.isFinite(numericValue) && numericValue <= integerValue
        })
        .sort(([, left], [, right]) => {
          const leftValue = Number.parseInt(
            (left.fields[fieldPath!] as { integerValue: string }).integerValue,
            10,
          )
          const rightValue = Number.parseInt(
            (right.fields[fieldPath!] as { integerValue: string }).integerValue,
            10,
          )
          return leftValue - rightValue
        })
        .slice(0, limit)

      return new Response(
        JSON.stringify(
          matchingDocuments.map(([path, document]) => ({
            document: {
              fields: document.fields,
              name: `projects/wow-threat/databases/(default)/documents/${path}`,
              updateTime: document.updateTime,
            },
          })),
        ),
        { status: 200 },
      )
    }

    if (!requestUrl.startsWith(firestorePrefix)) {
      throw new Error(
        `Unexpected request in Firestore client test: ${requestUrl}`,
      )
    }

    const relativePath = decodeURIComponent(
      requestUrl.slice(firestorePrefix.length).split('?')[0] ?? '',
    )
    const existing = documents.get(relativePath)
    const searchParams = new URLSearchParams(url.search)
    const currentUpdateTime = searchParams.get('currentDocument.updateTime')
    const updateMask = searchParams.getAll('updateMask.fieldPaths')

    if (method === 'GET') {
      if (!existing) {
        return new Response(
          JSON.stringify({
            error: {
              message: 'Document not found',
            },
          }),
          { status: 404 },
        )
      }

      return new Response(
        JSON.stringify({
          fields: existing.fields,
          updateTime: existing.updateTime,
        }),
        { status: 200 },
      )
    }

    if (method === 'PATCH') {
      if (
        currentUpdateTime &&
        (!existing || existing.updateTime !== currentUpdateTime)
      ) {
        return new Response(
          JSON.stringify({
            error: {
              message: 'Precondition failed',
            },
          }),
          { status: 412 },
        )
      }

      const body = init?.body
        ? (JSON.parse(init.body as string) as {
            fields?: Record<string, FirestoreValue>
          })
        : {
            fields: {},
          }
      const nextFields = {
        ...(existing?.fields ?? {}),
      }

      if (updateMask.length > 0) {
        updateMask.forEach((fieldPath) => {
          if (body.fields && fieldPath in body.fields) {
            nextFields[fieldPath] = body.fields[fieldPath]!
          }
        })
      } else {
        Object.assign(nextFields, body.fields ?? {})
      }

      const updateTime = new Date(Date.now()).toISOString()
      documents.set(relativePath, {
        fields: nextFields,
        updateTime,
      })

      return new Response(
        JSON.stringify({
          fields: nextFields,
          updateTime,
        }),
        { status: 200 },
      )
    }

    if (method === 'DELETE') {
      if (!existing) {
        return new Response(
          JSON.stringify({
            error: {
              message: 'Document not found',
            },
          }),
          { status: 404 },
        )
      }

      documents.delete(relativePath)
      return new Response(JSON.stringify({}), {
        status: 200,
      })
    }

    throw new Error(`Unexpected method in Firestore client test: ${method}`)
  })
}

describe('FirestoreClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', createMockFirestoreFetch())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('writes and reads documents', async () => {
    const client = new FirestoreClient(createMockBindings())
    await client.patchDocument('wcl_auth_tokens', 'uid-1', {
      uid: stringField('uid-1'),
    })

    const loaded = await client.getDocument('wcl_auth_tokens', 'uid-1')
    expect(loaded?.fields?.uid).toEqual({
      stringValue: 'uid-1',
    })
  })

  it('returns null for missing documents', async () => {
    const client = new FirestoreClient(createMockBindings())
    const loaded = await client.getDocument('wcl_auth_tokens', 'missing')

    expect(loaded).toBeNull()
  })

  it('returns null for failed precondition updates', async () => {
    const client = new FirestoreClient(createMockBindings())
    await client.patchDocument('wcl_bridge_codes', 'code-1', {
      used: {
        booleanValue: false,
      },
    })

    const result = await client.patchDocument(
      'wcl_bridge_codes',
      'code-1',
      {
        used: {
          booleanValue: true,
        },
      },
      {
        currentUpdateTime: 'incorrect-time',
        updateMask: ['used'],
      },
    )

    expect(result).toBeNull()
  })

  it('deletes existing documents and ignores missing ones', async () => {
    const client = new FirestoreClient(createMockBindings())
    await client.patchDocument('wcl_auth_tokens', 'uid-2', {
      uid: stringField('uid-2'),
    })

    await expect(
      client.deleteDocument('wcl_auth_tokens', 'uid-2'),
    ).resolves.toBeUndefined()
    await expect(
      client.deleteDocument('wcl_auth_tokens', 'uid-2'),
    ).resolves.toBeUndefined()
  })

  it('queries document ids by integer field with ordering and limits', async () => {
    const client = new FirestoreClient(createMockBindings())
    await client.patchDocument('wcl_bridge_codes', 'code-c', {
      expiresAtMs: integerField(300),
    })
    await client.patchDocument('wcl_bridge_codes', 'code-a', {
      expiresAtMs: integerField(100),
    })
    await client.patchDocument('wcl_bridge_codes', 'code-b', {
      expiresAtMs: integerField(200),
    })

    const matchingCodes = await client.queryDocumentIdsByIntegerField(
      'wcl_bridge_codes',
      'expiresAtMs',
      250,
      2,
    )

    expect(matchingCodes).toEqual(['code-a', 'code-b'])
  })

  it('returns an empty list when query finds no matching documents', async () => {
    const client = new FirestoreClient(createMockBindings())
    await client.patchDocument('wcl_bridge_codes', 'code-z', {
      expiresAtMs: integerField(500),
    })

    const matchingCodes = await client.queryDocumentIdsByIntegerField(
      'wcl_bridge_codes',
      'expiresAtMs',
      200,
      10,
    )

    expect(matchingCodes).toEqual([])
  })
})
