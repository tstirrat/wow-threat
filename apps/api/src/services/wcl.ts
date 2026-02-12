/**
 * WCL API Client
 *
 * Handles OAuth authentication and GraphQL queries to WCL API.
 */
import type {
  WCLEventsResponse,
  WCLReportResponse,
} from '@wcl-threat/wcl-types'

import { wclApiError, wclRateLimited } from '../middleware/error'
import type { Bindings } from '../types/bindings'
import { CacheKeys, type CacheService, createCache } from './cache'

const WCL_API_URL = 'https://www.warcraftlogs.com/api/v2/client'
const WCL_TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token'

interface OAuthToken {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number // Added for tracking expiration
}

export class WCLClient {
  private cache: CacheService
  private env: Bindings

  constructor(env: Bindings) {
    this.env = env
    this.cache = createCache(env, 'wcl')
  }

  /**
   * Get a valid OAuth token, refreshing if necessary
   */
  private async getToken(): Promise<string> {
    // Check cache first
    const cached = await this.cache.get<OAuthToken>(CacheKeys.wclToken())
    if (cached && cached.expires_at > Date.now() + 60000) {
      // 1 min buffer
      return cached.access_token
    }

    // Fetch new token
    const credentials = btoa(
      `${this.env.WCL_CLIENT_ID}:${this.env.WCL_CLIENT_SECRET}`,
    )

    const response = await fetch(WCL_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (!response.ok) {
      throw wclApiError(`Failed to get WCL OAuth token: ${response.status}`)
    }

    const token = (await response.json()) as OAuthToken
    token.expires_at = Date.now() + token.expires_in * 1000

    // Cache the token (expire 5 minutes early)
    await this.cache.set(CacheKeys.wclToken(), token, token.expires_in - 300)

    return token.access_token
  }

  /**
   * Execute a GraphQL query against WCL API
   */
  private async query<T>(
    graphqlQuery: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    const token = await this.getToken()

    const response = await fetch(WCL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables,
      }),
    })

    if (response.status === 429) {
      throw wclRateLimited()
    }

    if (!response.ok) {
      throw wclApiError(`WCL API error: ${response.status}`)
    }

    const result = (await response.json()) as {
      data?: T
      errors?: Array<{ message: string }>
    }

    if (result.errors?.length) {
      throw wclApiError(result.errors[0]?.message ?? 'Unknown GraphQL error')
    }

    if (!result.data) {
      throw wclApiError('No data returned from WCL API')
    }

    return result.data
  }

  /**
   * Get report metadata
   */
  async getReport(code: string): Promise<WCLReportResponse['data']> {
    // Check cache
    const cacheKey = CacheKeys.report(code)
    const cached = await this.cache.get<WCLReportResponse['data']>(cacheKey)
    if (cached) {
      return cached
    }

    const query = `
      query GetReport($code: String!) {
        reportData {
          report(code: $code) {
            code
            title
            owner { name }
            startTime
            endTime
            zone {
              id
              name
              expansion { id name }
              partitions { id name }
            }
            fights {
              id
              encounterID
              classicSeasonID
              name
              startTime
              endTime
              kill
              difficulty
              bossPercentage
              fightPercentage
              enemyNPCs {
                id
                gameID
                instanceCount
                groupCount
                petOwner
              }
              enemyPets {
                id
                gameID
                instanceCount
                groupCount
                petOwner
              }
              friendlyPlayers
              friendlyPets {
                id
                gameID
                instanceCount
                groupCount
                petOwner
              }
            }
            masterData {
              gameVersion
              actors {
                id
                name
                type
                subType
                petOwner
              }
              abilities {
                gameID
                icon
                name
                type
              }
            }
          }
        }
      }
    `

    const data = await this.query<WCLReportResponse['data']>(query, { code })

    // Cache permanently (report metadata never changes)
    await this.cache.set(cacheKey, data)

    return data
  }

  /**
   * Get events for a fight
   */
  async getEvents(
    code: string,
    fightId: number,
    startTime?: number,
    endTime?: number,
  ): Promise<unknown[]> {
    // Check cache
    const cacheKey = CacheKeys.events(code, fightId)
    const cached = await this.cache.get<unknown[]>(cacheKey)
    if (cached) {
      return cached
    }

    const allEvents: unknown[] = []
    let nextPageTimestamp: number | null = startTime ?? null

    // Paginate through all events
    do {
      const query = `
        query GetEvents($code: String!, $fightId: Int!, $startTime: Float, $endTime: Float) {
          reportData {
            report(code: $code) {
              events(
                fightIDs: [$fightId]
                startTime: $startTime
                endTime: $endTime
                limit: 10000
              ) {
                data
                nextPageTimestamp
              }
            }
          }
        }
      `

      const data = await this.query<WCLEventsResponse['data']>(query, {
        code,
        fightId,
        startTime: nextPageTimestamp,
        endTime,
      })

      const events = data.reportData.report.events
      allEvents.push(...events.data)
      nextPageTimestamp = events.nextPageTimestamp
    } while (nextPageTimestamp !== null)

    // Cache permanently
    await this.cache.set(cacheKey, allEvents)

    return allEvents
  }
}
