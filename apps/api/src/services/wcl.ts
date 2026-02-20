/**
 * Warcraft Logs API client with visibility-aware caching and private token support.
 */
import type {
  WCLEventsResponse,
  WCLReportResponse,
} from '@wcl-threat/wcl-types'

import {
  AppError,
  unauthorized,
  wclApiError,
  wclRateLimited,
} from '../middleware/error'
import type { Bindings } from '../types/bindings'
import { AuthStore } from './auth-store'
import {
  CacheKeys,
  type CacheService,
  createCache,
  normalizeVisibility,
} from './cache'
import { refreshWclAccessToken } from './wcl-oauth'

const WCL_API_URL = 'https://www.warcraftlogs.com/api/v2/client'
const WCL_TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token'

interface OAuthToken {
  access_token: string
  expires_at: number
  expires_in: number
  token_type: string
}

interface WclQueryResult<T> {
  data?: T
  errors?: Array<{ message: string }>
}

function shouldFallbackToUserToken(error: unknown): boolean {
  if (!(error instanceof AppError)) {
    return true
  }

  return /access|forbidden|permission|private|unauthorized/i.test(error.message)
}

export class WCLClient {
  private readonly authStore: AuthStore
  private readonly cache: CacheService
  private readonly env: Bindings
  private readonly uid: string

  constructor(env: Bindings, uid: string) {
    this.env = env
    this.uid = uid
    this.cache = createCache(env, 'wcl')
    this.authStore = new AuthStore(env)
  }

  /**
   * Get a valid client credentials token, refreshing it as needed.
   */
  private async getClientToken(): Promise<string> {
    const cached = await this.cache.get<OAuthToken>(CacheKeys.wclToken())
    if (cached && cached.expires_at > Date.now() + 60_000) {
      return cached.access_token
    }

    const credentials = btoa(
      `${this.env.WCL_CLIENT_ID}:${this.env.WCL_CLIENT_SECRET}`,
    )
    const response = await fetch(WCL_TOKEN_URL, {
      body: 'grant_type=client_credentials',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    })

    if (!response.ok) {
      throw wclApiError(`Failed to get WCL OAuth token: ${response.status}`)
    }

    const token = (await response.json()) as OAuthToken
    token.expires_at = Date.now() + token.expires_in * 1000
    await this.cache.set(CacheKeys.wclToken(), token, token.expires_in - 300)

    return token.access_token
  }

  /**
   * Resolve a valid user access token from Firestore and refresh when expired.
   */
  private async getUserAccessToken(): Promise<string> {
    const tokenRecord = await this.authStore.getWclTokens(this.uid)
    if (!tokenRecord) {
      throw unauthorized('No Warcraft Logs tokens found for this user')
    }

    if (tokenRecord.accessTokenExpiresAtMs > Date.now() + 60_000) {
      return tokenRecord.accessToken
    }

    if (!tokenRecord.refreshToken) {
      throw unauthorized('Warcraft Logs token has expired; sign in again')
    }

    const refreshed = await refreshWclAccessToken(
      this.env,
      tokenRecord.refreshToken,
    )
    const nextRefreshToken = refreshed.refresh_token ?? tokenRecord.refreshToken
    await this.authStore.saveWclTokens({
      accessToken: refreshed.access_token,
      accessTokenExpiresAtMs: Date.now() + refreshed.expires_in * 1000,
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAtMs: tokenRecord.refreshTokenExpiresAtMs,
      tokenType: refreshed.token_type,
      uid: this.uid,
      wclUserId: tokenRecord.wclUserId,
      wclUserName: tokenRecord.wclUserName,
    })

    return refreshed.access_token
  }

  /**
   * Execute a GraphQL request against WCL API.
   */
  private async query<T>(
    graphqlQuery: string,
    variables: Record<string, unknown>,
    options: { accessToken?: string } = {},
  ): Promise<T> {
    const accessToken = options.accessToken ?? (await this.getClientToken())
    const response = await fetch(WCL_API_URL, {
      body: JSON.stringify({
        query: graphqlQuery,
        variables,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (response.status === 429) {
      throw wclRateLimited()
    }
    if (!response.ok) {
      throw wclApiError(`WCL API error: ${response.status}`)
    }

    const result = (await response.json()) as WclQueryResult<T>
    if (result.errors?.length) {
      throw wclApiError(result.errors[0]?.message ?? 'Unknown GraphQL error')
    }
    if (!result.data) {
      throw wclApiError('No data returned from WCL API')
    }

    return result.data
  }

  /**
   * Store report metadata in visibility-aware cache namespaces.
   */
  private async cacheReport(
    code: string,
    data: WCLReportResponse['data'],
  ): Promise<void> {
    const visibility = normalizeVisibility(data.reportData.report.visibility)
    const cacheKey = CacheKeys.report(
      code,
      visibility,
      visibility === 'private' ? this.uid : undefined,
    )
    await this.cache.set(cacheKey, data)
  }

  /**
   * Get report metadata, including visibility, with client-token fallback to user-token.
   */
  async getReport(code: string): Promise<WCLReportResponse['data']> {
    const privateCacheKey = CacheKeys.report(code, 'private', this.uid)
    const publicCacheKey = CacheKeys.report(code, 'public')

    const privateCached =
      await this.cache.get<WCLReportResponse['data']>(privateCacheKey)
    if (privateCached) {
      return privateCached
    }

    const publicCached =
      await this.cache.get<WCLReportResponse['data']>(publicCacheKey)
    if (publicCached) {
      return publicCached
    }

    const query = `
      query GetReport($code: String!) {
        reportData {
          report(code: $code) {
            code
            title
            visibility
            owner { name }
            guild {
              name
              faction {
                id
                name
              }
            }
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

    try {
      const clientData = await this.query<WCLReportResponse['data']>(query, {
        code,
      })
      if (clientData.reportData.report) {
        await this.cacheReport(code, clientData)
        return clientData
      }
    } catch (error) {
      if (!shouldFallbackToUserToken(error)) {
        throw error
      }
      // A failed client-token query may indicate a private report. Fall through.
    }

    const userAccessToken = await this.getUserAccessToken()
    const userData = await this.query<WCLReportResponse['data']>(
      query,
      { code },
      { accessToken: userAccessToken },
    )

    if (!userData.reportData.report) {
      throw wclApiError('Report not found')
    }

    await this.cacheReport(code, userData)
    return userData
  }

  /**
   * Get fight events using visibility-specific cache scope and token selection.
   */
  async getEvents(
    code: string,
    fightId: number,
    visibility: unknown,
    startTime?: number,
    endTime?: number,
    options: { bypassCache?: boolean } = {},
  ): Promise<unknown[]> {
    const { bypassCache = false } = options
    const normalizedVisibility = normalizeVisibility(visibility)
    const cacheKey = CacheKeys.events(
      code,
      fightId,
      normalizedVisibility,
      normalizedVisibility === 'private' ? this.uid : undefined,
      startTime,
      endTime,
    )

    if (!bypassCache) {
      const cached = await this.cache.get<unknown[]>(cacheKey)
      if (cached) {
        return cached
      }
    }

    const accessToken =
      normalizedVisibility === 'private'
        ? await this.getUserAccessToken()
        : undefined

    const allEvents: unknown[] = []
    let requestStartTime = startTime

    while (true) {
      const query = `
        query GetEvents($code: String!, $fightId: Int!, $startTime: Float, $endTime: Float) {
          reportData {
            report(code: $code) {
              events(
                fightIDs: [$fightId]
                startTime: $startTime
                endTime: $endTime
                limit: 10000
                includeResources: true
              ) {
                data
                nextPageTimestamp
              }
            }
          }
        }
      `

      const data = await this.query<WCLEventsResponse['data']>(
        query,
        {
          code,
          endTime,
          fightId,
          startTime: requestStartTime,
        },
        {
          accessToken,
        },
      )
      const events = data.reportData.report.events
      allEvents.push(...events.data)

      if (!events.nextPageTimestamp) {
        break
      }
      requestStartTime = events.nextPageTimestamp
    }

    await this.cache.set(cacheKey, allEvents)
    return allEvents
  }
}
