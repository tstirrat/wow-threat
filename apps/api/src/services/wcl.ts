/**
 * Warcraft Logs API client with visibility-aware caching and private token support.
 */
import type {
  WCLEventsResponse,
  WCLReportResponse,
} from '@wow-threat/wcl-types'

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
import { buildWclRateLimitDetails } from './wcl-rate-limit'

const WCL_CLIENT_API_URL = 'https://www.warcraftlogs.com/api/v2/client'
const WCL_USER_API_URL = 'https://www.warcraftlogs.com/api/v2/user'
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

interface WclCurrentUserGuild {
  id?: number | string | null
}

interface WclCurrentUserProfileData {
  userData?: {
    currentUser?: {
      id?: number | string | null
      guilds?: WclCurrentUserGuild[] | null
    } | null
  } | null
}

interface WclRecentReportsData {
  reportData?: {
    reports?: {
      data?: WclRecentReportNode[] | null
    } | null
  } | null
}

interface WclRecentReportNode {
  code?: string | null
  title?: string | null
  startTime?: number | null
  endTime?: number | null
  zone?: {
    name?: string | null
  } | null
  guild?: {
    name?: string | null
    faction?:
      | string
      | {
          name?: string | null
        }
      | null
  } | null
  archiveStatus?: {
    isArchived?: boolean | null
    isAccessible?: boolean | null
    archiveDate?: number | null
  } | null
}

export type RecentWclReportSource = 'personal' | 'guild'

export interface RecentWclReport {
  code: string
  title: string
  startTime: number
  endTime: number
  zoneName: string | null
  guildName: string | null
  guildFaction: string | null
  source: RecentWclReportSource
}

const maxRecentReportsLimit = 20
const friendlyBuffTableAbilityIdKeys = [
  'abilityGameID',
  'abilityID',
  'abilityId',
  'gameID',
  'gameId',
] as const

type UnknownRecord = Record<string, unknown>

interface WclFriendlyBuffBandsData {
  reportData?: {
    report?: UnknownRecord | null
  } | null
}

interface FriendlyBuffBand {
  startTime: number
  endTime: number | null
}

interface FriendlyBuffBandEntry {
  actorId: number
  abilityId: number
  bands: FriendlyBuffBand[]
}

type FriendlyBuffBandsResolutionSource = 'actor-scoped-batch' | 'legacy'

interface CachedFriendlyBuffBands {
  entries: FriendlyBuffBandEntry[]
  source: FriendlyBuffBandsResolutionSource
}

interface ActorScopedFriendlyBuffQuery {
  aliasToActorId: Map<string, number>
  query: string
}

function shouldFallbackToUserToken(error: unknown): boolean {
  if (!(error instanceof AppError)) {
    return true
  }

  return /access|forbidden|permission|private|unauthorized/i.test(error.message)
}

function parseNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseGuildFaction(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && value && 'name' in value) {
    const factionName = value.name
    return typeof factionName === 'string' ? factionName : null
  }

  return null
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null
    ? (value as UnknownRecord)
    : null
}

function readNumericField(
  record: UnknownRecord,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const parsed = parseNumericId(record[key])
    if (parsed !== null) {
      return parsed
    }
  }

  return null
}

function parseFriendlyBuffBands(value: unknown): FriendlyBuffBand[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    const record = asRecord(entry)
    if (!record) {
      return []
    }

    const startTime = parseNumericId(record.startTime)
    const endTime = parseNumericId(record.endTime)
    if (startTime === null) {
      return []
    }
    if (endTime !== null && endTime <= startTime) {
      return []
    }

    return [
      {
        startTime,
        endTime,
      },
    ]
  })
}

function collectFriendlyBuffBandEntries(
  value: unknown,
  entries: FriendlyBuffBandEntry[],
  actorId: number,
): void {
  if (Array.isArray(value)) {
    value.forEach((nested) =>
      collectFriendlyBuffBandEntries(nested, entries, actorId),
    )
    return
  }

  const record = asRecord(value)
  if (!record) {
    return
  }

  const abilityId = readNumericField(record, friendlyBuffTableAbilityIdKeys)
  const bands = parseFriendlyBuffBands(record.bands)
  if (abilityId !== null && bands.length > 0) {
    entries.push({
      actorId,
      abilityId,
      bands,
    })
  }

  Object.values(record).forEach((nested) =>
    collectFriendlyBuffBandEntries(nested, entries, actorId),
  )
}

function parseFriendlyBuffTablePayload(payload: unknown): unknown {
  if (typeof payload !== 'string') {
    return payload
  }

  try {
    return JSON.parse(payload) as unknown
  } catch {
    return null
  }
}

function parseCachedFriendlyBuffBands(
  value: FriendlyBuffBandEntry[] | CachedFriendlyBuffBands,
): CachedFriendlyBuffBands {
  if (Array.isArray(value)) {
    return {
      entries: value,
      source: 'legacy',
    }
  }

  return value
}

function extractBuffBandEntriesForActor(
  tablePayload: unknown,
  actorId: number,
): FriendlyBuffBandEntry[] {
  const parsedPayload = parseFriendlyBuffTablePayload(tablePayload)
  const buffEntries: FriendlyBuffBandEntry[] = []
  collectFriendlyBuffBandEntries(parsedPayload, buffEntries, actorId)

  return buffEntries.filter((entry) => entry.actorId === actorId)
}

function filterFightStartAurasByFriendlies(
  buffBandEntries: FriendlyBuffBandEntry[],
  fightStartTime: number,
  friendlyActorIds: Set<number>,
): Map<number, number[]> {
  const auraIdsByActor = buffBandEntries.reduce((result, entry) => {
    if (!friendlyActorIds.has(entry.actorId)) {
      return result
    }

    const hasBandAtFightStart = entry.bands.some(
      (band) =>
        band.startTime <= fightStartTime &&
        (band.endTime === null || band.endTime > fightStartTime),
    )
    if (!hasBandAtFightStart) {
      return result
    }

    const auraIds = result.get(entry.actorId) ?? new Set<number>()
    auraIds.add(entry.abilityId)
    result.set(entry.actorId, auraIds)

    return result
  }, new Map<number, Set<number>>())

  return [...auraIdsByActor.entries()].reduce((result, [actorId, auraIds]) => {
    result.set(
      actorId,
      [...auraIds].sort((left, right) => left - right),
    )
    return result
  }, new Map<number, number[]>())
}

function buildActorScopedFriendlyBuffQuery(
  fightIds: readonly number[],
  friendlyActorIds: Set<number>,
): ActorScopedFriendlyBuffQuery | null {
  if (fightIds.length === 0) {
    return null
  }

  const sortedFriendlyActorIds = [...friendlyActorIds].sort(
    (left, right) => left - right,
  )
  if (sortedFriendlyActorIds.length === 0) {
    return null
  }

  const aliasToActorId = sortedFriendlyActorIds.reduce((result, actorId) => {
    result.set(`friendly_${actorId}`, actorId)
    return result
  }, new Map<string, number>())

  const fields = [...aliasToActorId.entries()].map(
    ([alias, actorId]) =>
      `${alias}: table(fightIDs: $fightIDs, dataType: Buffs, hostilityType: Friendlies, sourceID: ${actorId})`,
  )

  return {
    aliasToActorId,
    query: `
      query GetFriendlyBuffBandsByActor($code: String!, $fightIDs: [Int!]!) {
        reportData {
          report(code: $code) {
            ${fields.join('\n            ')}
          }
        }
      }
    `,
  }
}

function toRecentWclReport(
  node: WclRecentReportNode,
  source: RecentWclReportSource,
): RecentWclReport | null {
  if (!node.code || typeof node.code !== 'string') {
    return null
  }
  if (typeof node.startTime !== 'number' || typeof node.endTime !== 'number') {
    return null
  }

  return {
    code: node.code,
    title:
      typeof node.title === 'string' && node.title.length > 0
        ? node.title
        : node.code,
    startTime: node.startTime,
    endTime: node.endTime,
    zoneName: typeof node.zone?.name === 'string' ? node.zone.name : null,
    guildName: typeof node.guild?.name === 'string' ? node.guild.name : null,
    guildFaction: parseGuildFaction(node.guild?.faction),
    source,
  }
}

function canAccessReportEvents(node: WclRecentReportNode): boolean {
  const isArchived = node.archiveStatus?.isArchived === true
  const isInaccessible = node.archiveStatus?.isAccessible === false

  return !isArchived && !isInaccessible
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
    options: { accessToken?: string; scope?: 'client' | 'user' } = {},
  ): Promise<T> {
    const accessToken = options.accessToken ?? (await this.getClientToken())
    const scope = options.scope ?? (options.accessToken ? 'user' : 'client')
    const apiUrl = scope === 'user' ? WCL_USER_API_URL : WCL_CLIENT_API_URL
    const response = await fetch(apiUrl, {
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
      const retryAfter = response.headers.get('Retry-After')
      throw wclRateLimited(
        buildWclRateLimitDetails(`wcl-${scope}-graphql`, retryAfter),
      )
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
              archiveStatus {
                isArchived
                isAccessible
                archiveDate
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

  private async getCurrentUserProfile(
    accessToken: string,
  ): Promise<{ userId: number; guildIds: number[] }> {
    const query = `
      query CurrentUserProfile {
        userData {
          currentUser {
            id
            guilds {
              id
            }
          }
        }
      }
    `
    const profile = await this.query<WclCurrentUserProfileData>(
      query,
      {},
      { accessToken },
    )
    const userId = parseNumericId(profile.userData?.currentUser?.id)
    const guildIds = (profile.userData?.currentUser?.guilds ?? [])
      .map((guild) => parseNumericId(guild.id))
      .filter((guildId): guildId is number => guildId !== null)
    const dedupedGuildIds = Array.from(new Set(guildIds))

    if (userId === null) {
      throw wclApiError('WCL user profile did not include a valid user id')
    }

    return {
      userId,
      guildIds: dedupedGuildIds,
    }
  }

  private async getRecentReportsByOwner(
    accessToken: string,
    options:
      | {
          userId: number
          source: 'personal'
        }
      | {
          guildId: number
          source: 'guild'
        },
    limit: number,
  ): Promise<RecentWclReport[]> {
    const query = `
      query RecentReports($userID: Int, $guildID: Int, $limit: Int!) {
        reportData {
          reports(userID: $userID, guildID: $guildID, limit: $limit) {
            data {
              code
              title
              startTime
              endTime
              zone {
                name
              }
              guild {
                name
                faction {
                  name
                }
              }
              archiveStatus {
                isArchived
                isAccessible
                archiveDate
              }
            }
          }
        }
      }
    `
    const variables =
      options.source === 'personal'
        ? {
            limit,
            userID: options.userId,
          }
        : {
            guildID: options.guildId,
            limit,
          }
    const response = await this.query<WclRecentReportsData>(query, variables, {
      accessToken,
    })
    const reports = response.reportData?.reports?.data ?? []

    return reports
      .filter((report) => canAccessReportEvents(report))
      .map((report) => toRecentWclReport(report, options.source))
      .filter((report): report is RecentWclReport => report !== null)
  }

  /** Get a merged list of current-user and guild recent reports. */
  async getRecentReports(limit = 10): Promise<RecentWclReport[]> {
    const boundedLimit = Math.min(
      Math.max(Math.trunc(limit), 1),
      maxRecentReportsLimit,
    )
    const accessToken = await this.getUserAccessToken()
    const { guildIds, userId } = await this.getCurrentUserProfile(accessToken)
    const personalReports = await this.getRecentReportsByOwner(
      accessToken,
      {
        source: 'personal',
        userId,
      },
      boundedLimit,
    )
    const guildReports = (
      await Promise.all(
        guildIds.map((guildId) =>
          this.getRecentReportsByOwner(
            accessToken,
            {
              guildId,
              source: 'guild',
            },
            boundedLimit,
          ),
        ),
      )
    ).flat()
    const sortedCombinedReports = [...personalReports, ...guildReports].sort(
      (left, right) => {
        if (right.startTime !== left.startTime) {
          return right.startTime - left.startTime
        }

        if (left.source === right.source) {
          return 0
        }

        return left.source === 'personal' ? -1 : 1
      },
    )
    const deduped = new Map<string, RecentWclReport>()

    sortedCombinedReports.forEach((report) => {
      if (!deduped.has(report.code)) {
        deduped.set(report.code, report)
      }
    })

    return Array.from(deduped.values()).slice(0, boundedLimit)
  }

  /**
   * Resolve active buff aura IDs on friendlies at the exact start of a fight.
   */
  async getFriendlyBuffAurasAtFightStart(
    code: string,
    fightId: number,
    visibility: unknown,
    fightStartTime: number,
    friendlyActorIds: Set<number>,
    options: {
      bypassCache?: boolean
      queryFightIds?: number[]
      queryFriendlyActorIds?: Set<number>
    } = {},
  ): Promise<Map<number, number[]>> {
    if (friendlyActorIds.size === 0) {
      return new Map()
    }

    const { bypassCache = false } = options
    const queryFightIds = [...new Set(options.queryFightIds ?? [fightId])]
      .map((queryFightId) => Math.trunc(queryFightId))
      .filter(Number.isFinite)
    const queryFriendlyActorIds =
      options.queryFriendlyActorIds ?? friendlyActorIds
    if (queryFightIds.length === 0 || queryFriendlyActorIds.size === 0) {
      return new Map()
    }

    const normalizedVisibility = normalizeVisibility(visibility)
    const cacheKey = CacheKeys.friendlyBuffBandsByReport(
      code,
      normalizedVisibility,
      normalizedVisibility === 'private' ? this.uid : undefined,
    )

    if (!bypassCache) {
      const cached = await this.cache.get<
        FriendlyBuffBandEntry[] | CachedFriendlyBuffBands
      >(cacheKey)
      if (cached) {
        const normalizedCache = parseCachedFriendlyBuffBands(cached)
        console.info('[WCL] Friendly buff bands cache hit', {
          code,
          fightId,
          source: normalizedCache.source,
          auraBandEntries: normalizedCache.entries.length,
        })
        return filterFightStartAurasByFriendlies(
          normalizedCache.entries,
          fightStartTime,
          friendlyActorIds,
        )
      }
    }

    const accessToken =
      normalizedVisibility === 'private'
        ? await this.getUserAccessToken()
        : undefined

    try {
      console.info(
        '[WCL] Friendly buff bands resolving via actor-scoped batch query',
        {
          code,
          fightId,
          queryFightCount: queryFightIds.length,
          queryFriendlyActors: queryFriendlyActorIds.size,
        },
      )
      const resolvedBuffBands = await this.getActorScopedBuffBands({
        code,
        fightIds: queryFightIds,
        accessToken,
        friendlyActorIds: queryFriendlyActorIds,
      })
      const cachedPayload: CachedFriendlyBuffBands = {
        entries: resolvedBuffBands,
        source: 'actor-scoped-batch',
      }
      await this.cache.set(cacheKey, cachedPayload)
      return filterFightStartAurasByFriendlies(
        resolvedBuffBands,
        fightStartTime,
        friendlyActorIds,
      )
    } catch (error) {
      console.warn('[WCL] Failed to load friendly buff bands', {
        code,
        fightId,
        error,
      })
      return new Map()
    }
  }

  private async getActorScopedBuffBands({
    code,
    fightIds,
    accessToken,
    friendlyActorIds,
  }: {
    code: string
    fightIds: number[]
    accessToken?: string
    friendlyActorIds: Set<number>
  }): Promise<FriendlyBuffBandEntry[]> {
    const actorScopedQuery = buildActorScopedFriendlyBuffQuery(
      fightIds,
      friendlyActorIds,
    )
    if (!actorScopedQuery) {
      return []
    }

    const data = await this.query<WclFriendlyBuffBandsData>(
      actorScopedQuery.query,
      {
        code,
        fightIDs: fightIds,
      },
      {
        accessToken,
      },
    )

    const reportRecord = asRecord(data.reportData?.report)
    if (!reportRecord) {
      return []
    }
    const resolvedEntries = [
      ...actorScopedQuery.aliasToActorId.entries(),
    ].flatMap(([alias, actorId]) => {
      const buffEntries = extractBuffBandEntriesForActor(
        reportRecord[alias],
        actorId,
      )
      return buffEntries
    })
    console.info('[WCL] Friendly buff bands actor-scoped batch resolved', {
      code,
      queryFightCount: fightIds.length,
      actorQueries: actorScopedQuery.aliasToActorId.size,
      auraBandEntries: resolvedEntries.length,
    })
    return resolvedEntries
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
