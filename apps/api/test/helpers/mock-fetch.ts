/**
 * Mock Fetch Utilities for Integration Tests
 *
 * Provides helpers to mock WCL API responses per-test.
 */
import { vi } from 'vitest'

export interface MockWCLResponses {
  token?: {
    access_token: string
    token_type: string
    expires_in: number
  }
  /** Raw report data (the content inside reportData.report) */
  report?: {
    code: string
    title: string
    owner: { name: string }
    guild?: {
      name: string
      faction:
        | string
        | {
            id: number
            name: string
          }
    } | null
    startTime: number
    endTime: number
    zone: {
      id: number
      name: string
      expansion?: { id: number; name: string }
      partitions?: Array<{ id: number; name: string }>
    }
    fights: Array<{
      id: number
      encounterID?: number | null
      classicSeasonID?: number | null
      name: string
      startTime: number
      endTime: number
      kill: boolean
      difficulty: unknown
      bossPercentage: number
      fightPercentage: number
      enemyNPCs?: Array<{
        id: number
        gameID: number
        instanceCount: number
        groupCount: number
        petOwner: number | null
      }>
      enemyPets?: Array<{
        id: number
        gameID: number
        instanceCount: number
        groupCount: number
        petOwner: number | null
      }>
      friendlyPlayers?: number[]
      friendlyPets?: Array<{
        id: number
        gameID: number
        instanceCount: number
        groupCount: number
        petOwner: number | null
      }>
    }>
    masterData: {
      gameVersion: number
      actors: Array<{
        id: number
        name: string
        type: string
        subType: string
        petOwner: number | null
      }>
      abilities?: Array<{
        gameID: number | null
        icon: string | null
        name: string | null
        type: string | null
      }>
    }
  }
  events?: unknown[]
  eventsPages?: Array<{
    startTime?: number | null
    data: unknown[]
    nextPageTimestamp: number | null
  }>
}

const defaultTokenResponse = {
  access_token: 'mock-token-12345',
  token_type: 'Bearer',
  expires_in: 3600,
}

/**
 * Create a mock fetch function that returns specified WCL responses
 */
export function createMockFetch(responses: MockWCLResponses = {}) {
  return vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString()

      // OAuth token endpoint
      if (url.includes('warcraftlogs.com/oauth/token')) {
        return new Response(
          JSON.stringify(responses.token ?? defaultTokenResponse),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // GraphQL API endpoint
      if (url.includes('warcraftlogs.com/api/v2')) {
        const body = init?.body ? JSON.parse(init.body as string) : {}
        const query = body.query as string

        // Report query - wrap in proper GraphQL structure
        if (
          query?.includes('GetReport') ||
          (query?.includes('report(code:') && !query?.includes('events('))
        ) {
          if (!responses.report) {
            // Return GraphQL error for not found
            return new Response(
              JSON.stringify({
                errors: [{ message: 'Report not found' }],
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }
          // Return properly wrapped GraphQL response
          return new Response(
            JSON.stringify({
              data: {
                reportData: {
                  report: responses.report,
                },
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        // Events query
        if (query?.includes('GetEvents') || query?.includes('events(')) {
          const requestStartTime =
            (body.variables?.startTime as number | null | undefined) ?? null
          const pagedResponse = responses.eventsPages?.find(
            (page) => (page.startTime ?? null) === requestStartTime,
          )

          return new Response(
            JSON.stringify({
              data: {
                reportData: {
                  report: {
                    events: {
                      data: pagedResponse?.data ?? responses.events ?? [],
                      nextPageTimestamp:
                        pagedResponse?.nextPageTimestamp ?? null,
                    },
                  },
                },
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      }

      // Unknown request - fail loudly
      throw new Error(`Unexpected fetch request: ${url}`)
    },
  )
}

/**
 * Install mock fetch globally for a test
 */
export function mockFetch(responses: MockWCLResponses = {}) {
  const mock = createMockFetch(responses)
  vi.stubGlobal('fetch', mock)
  return mock
}

/**
 * Restore original fetch
 */
export function restoreFetch() {
  vi.unstubAllGlobals()
}
