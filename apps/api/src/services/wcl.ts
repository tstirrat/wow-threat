/**
 * Warcraft Logs API client with visibility-aware caching and private token support.
 */
import type {
  Report,
  ReportPlayerDetailsByRole,
  WCLEvent,
  WCLEventsResponse,
  WCLReportResponse,
} from '@wow-threat/wcl-types'

import {
  AppError,
  unauthorized,
  wclApiError,
  wclRateLimited,
} from '../middleware/error'
import type { WclRateLimitResponse } from '../types/api'
import type { ReportActorRole } from '../types/api'
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

interface WclGuildLookupData {
  guildData?: {
    guild?: WclGuildNode | null
  } | null
}

interface WclRateLimitData {
  rateLimitData?: {
    limitPerHour?: number | null
    pointsSpentThisHour?: number | null
    pointsResetIn?: number | null
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

interface WclGuildNode {
  id?: number | string | null
  name?: string | null
  faction?:
    | string
    | {
        name?: string | null
      }
    | null
  server?: {
    slug?: string | null
    region?: {
      slug?: string | null
      compactName?: string | null
      name?: string | null
    } | null
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

export interface GuildWclReference {
  id: number
  name: string
  faction: string | null
  serverSlug: string | null
  serverRegion: string | null
}

export interface GuildWclReports {
  guild: GuildWclReference
  reports: RecentWclReport[]
}

const maxRecentReportsLimit = 20
const wclEventsPageLimit = 5000
const maxCacheableWclEvents = 15000

interface WclFriendlyBuffTableAuraBand {
  endTime?: number | null
  startTime?: number | null
}

interface WclFriendlyBuffTableAuraRow {
  bands?: WclFriendlyBuffTableAuraBand[] | null
  guid?: number | null
}

interface WclFriendlyBuffTableData {
  auras?: WclFriendlyBuffTableAuraRow[] | null
}

interface WclFriendlyBuffTablePayload {
  data?: WclFriendlyBuffTableData | null
}

interface WclFriendlyBuffBandsData {
  reportData?: {
    report?: Record<string, WclFriendlyBuffTablePayload | null> | null
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

export interface WclEventsPage {
  data: WCLEvent[]
  nextPageTimestamp: number | null
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

interface EncounterFriendlyPlayer {
  id: number
  name: string
}

type ReportWithFightPlayerDetails = Pick<
  Report,
  'fights' | 'masterData' | 'playerDetails'
>

interface WclFightDetailsData {
  reportData?: {
    report?:
      | (ReportWithFightPlayerDetails & Pick<Report, 'code' | 'visibility'>)
      | null
  } | null
}

interface WclFightPlayerDetailsData {
  reportData?: {
    report?: Pick<Report, 'playerDetails'> | null
  } | null
}

function extractGraphQLOperationName(graphqlQuery: string): string {
  const match = /query\s+([A-Za-z0-9_]+)/.exec(graphqlQuery)
  return match?.[1] ?? 'AnonymousQuery'
}

function summarizeQueryVariables(
  variables: Record<string, unknown>,
): Record<string, unknown> {
  return Object.entries(variables).reduce<Record<string, unknown>>(
    (summary, [key, value]) => {
      if (value === null || value === undefined) {
        summary[key] = value
        return summary
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        summary[key] = value
        return summary
      }

      if (typeof value === 'string') {
        summary[key] = value.length > 24 ? `${value.slice(0, 24)}...` : value
        return summary
      }

      if (Array.isArray(value)) {
        summary[key] = {
          length: value.length,
          preview: value.slice(0, 3),
        }
        return summary
      }

      summary[key] = {
        type: typeof value,
      }
      return summary
    },
    {},
  )
}

function toErrorLogMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function monotonicNowMs(): number {
  if (typeof globalThis.performance?.now === 'function') {
    return globalThis.performance.now()
  }

  return Date.now()
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

function parseGuildServerRegion(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  if ('slug' in value && typeof value.slug === 'string') {
    return value.slug
  }

  if ('compactName' in value && typeof value.compactName === 'string') {
    return value.compactName
  }

  if ('name' in value && typeof value.name === 'string') {
    return value.name
  }

  return null
}

function toGuildWclReference(node: WclGuildNode): GuildWclReference | null {
  const id = parseNumericId(node.id)
  const name = typeof node.name === 'string' ? node.name.trim() : ''

  if (id === null || name.length === 0) {
    return null
  }

  return {
    id,
    name,
    faction: parseGuildFaction(node.faction),
    serverSlug: typeof node.server?.slug === 'string' ? node.server.slug : null,
    serverRegion: parseGuildServerRegion(node.server?.region),
  }
}

const roleByPlayerDetailsBucket = {
  dps: 'DPS',
  healers: 'Healer',
  tanks: 'Tank',
} as const satisfies Record<keyof ReportPlayerDetailsByRole, ReportActorRole>

function normalizePlayerDetailsBuckets(
  value: Report['playerDetails'] | null | undefined,
): ReportPlayerDetailsByRole {
  return value?.data?.playerDetails ?? {}
}

function resolvePrimarySpecName(
  playerSpecs: Array<{ spec: string; count: number }>,
): string | undefined {
  if (playerSpecs.length === 0) {
    return undefined
  }

  const sortedByCount = [...playerSpecs].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count
    }

    return left.spec.localeCompare(right.spec)
  })

  return sortedByCount[0]?.spec
}

function resolveRolesFromPlayerDetails({
  friendlyPlayerIds,
  playerDetails,
}: {
  friendlyPlayerIds: Set<number>
  playerDetails: Report['playerDetails'] | null | undefined
}): Map<number, ReportActorRole> {
  const roleMap = new Map<number, ReportActorRole>()
  const buckets = normalizePlayerDetailsBuckets(playerDetails)

  for (const roleBucket of ['tanks', 'healers', 'dps'] as const) {
    const players = buckets[roleBucket]
    if (!Array.isArray(players)) {
      continue
    }

    players.forEach((player) => {
      const actorId = parseNumericId(player.id)
      if (actorId === null || !friendlyPlayerIds.has(actorId)) {
        return
      }

      roleMap.set(actorId, roleByPlayerDetailsBucket[roleBucket])
    })
  }

  return roleMap
}

function resolveSpecsFromPlayerDetails({
  friendlyPlayerIds,
  playerDetails,
}: {
  friendlyPlayerIds: Set<number>
  playerDetails: Report['playerDetails'] | null | undefined
}): Map<number, string> {
  const specMap = new Map<number, string>()
  const buckets = normalizePlayerDetailsBuckets(playerDetails)

  for (const roleBucket of ['tanks', 'healers', 'dps'] as const) {
    const players = buckets[roleBucket]
    if (!Array.isArray(players)) {
      continue
    }

    players.forEach((player) => {
      const actorId = parseNumericId(player.id)
      if (actorId === null || !friendlyPlayerIds.has(actorId)) {
        return
      }

      const primarySpec = resolvePrimarySpecName(player.specs)
      if (primarySpec) {
        specMap.set(actorId, primarySpec)
      }
    })
  }

  return specMap
}

/** Resolve fight actor roles from report playerDetails metadata. */
export function resolveFightActorRoles(
  report: ReportWithFightPlayerDetails,
  fightId: number,
): Map<number, ReportActorRole> {
  const fight = report.fights.find((entry) => entry.id === fightId)
  if (!fight) {
    return new Map()
  }

  return resolveRolesFromPlayerDetails({
    friendlyPlayerIds: new Set(fight.friendlyPlayers ?? []),
    playerDetails: report.playerDetails,
  })
}

/** Resolve fight actor specs from report playerDetails metadata. */
export function resolveFightActorSpecs(
  report: ReportWithFightPlayerDetails,
  fightId: number,
): Map<number, string> {
  const fight = report.fights.find((entry) => entry.id === fightId)
  if (!fight) {
    return new Map()
  }

  return resolveSpecsFromPlayerDetails({
    friendlyPlayerIds: new Set(fight.friendlyPlayers ?? []),
    playerDetails: report.playerDetails,
  })
}

/** Resolve fight tank actor IDs from report playerDetails metadata. */
export function resolveFightTankActorIds(
  report: ReportWithFightPlayerDetails,
  fightId: number,
): Set<number> {
  const tankActorIds = new Set<number>()
  resolveFightActorRoles(report, fightId).forEach((role, actorId) => {
    if (role === 'Tank') {
      tankActorIds.add(actorId)
    }
  })
  return tankActorIds
}

function parseFriendlyBuffBands(
  value: WclFriendlyBuffTableAuraBand[] | null | undefined,
): FriendlyBuffBand[] {
  if (!value) {
    return []
  }

  return value.flatMap((entry) => {
    const startTime = parseNumericId(entry.startTime)
    const endTime = parseNumericId(entry.endTime)
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
  tablePayload: WclFriendlyBuffTablePayload | null | undefined,
  actorId: number,
): FriendlyBuffBandEntry[] {
  const auraRows = tablePayload?.data?.auras ?? []
  if (!Array.isArray(auraRows)) {
    return []
  }

  return auraRows.flatMap((auraRow) => {
    const abilityId = parseNumericId(auraRow.guid)
    const bands = parseFriendlyBuffBands(auraRow.bands)

    if (abilityId === null || bands.length === 0) {
      return []
    }

    return [
      {
        actorId,
        abilityId,
        bands,
      },
    ]
  })
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

function countFightStartAuraIdsByActor(value: Map<number, number[]>): number {
  return [...value.values()].reduce(
    (totalAuraIds, auraIds) => totalAuraIds + auraIds.length,
    0,
  )
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
      `${alias}: table(fightIDs: $fightIDs, dataType: Buffs, hostilityType: Friendlies, targetID: ${actorId}, viewBy: Target)`,
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

function parseWclRateLimitData(data: WclRateLimitData): WclRateLimitResponse {
  const limitPerHour = data.rateLimitData?.limitPerHour
  const pointsSpentThisHour = data.rateLimitData?.pointsSpentThisHour
  const pointsResetIn = data.rateLimitData?.pointsResetIn

  if (
    typeof limitPerHour !== 'number' ||
    !Number.isFinite(limitPerHour) ||
    typeof pointsSpentThisHour !== 'number' ||
    !Number.isFinite(pointsSpentThisHour) ||
    typeof pointsResetIn !== 'number' ||
    !Number.isFinite(pointsResetIn)
  ) {
    throw wclApiError('WCL rate limit payload was missing expected fields')
  }

  return {
    limitPerHour,
    pointsSpentThisHour,
    pointsResetIn,
  }
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
    const operationName = extractGraphQLOperationName(graphqlQuery)
    const queryStartedAt = monotonicNowMs()
    const tokenStartedAt = monotonicNowMs()
    const accessToken = options.accessToken ?? (await this.getClientToken())
    const tokenResolutionMs = monotonicNowMs() - tokenStartedAt
    const scope = options.scope ?? (options.accessToken ? 'user' : 'client')
    const apiUrl = scope === 'user' ? WCL_USER_API_URL : WCL_CLIENT_API_URL
    const variableSummary = summarizeQueryVariables(variables)
    let status: number | null = null

    try {
      const fetchStartedAt = monotonicNowMs()
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
      status = response.status
      const fetchDurationMs = monotonicNowMs() - fetchStartedAt

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        throw wclRateLimited(
          buildWclRateLimitDetails(`wcl-${scope}-graphql`, retryAfter),
        )
      }
      if (!response.ok) {
        throw wclApiError(`WCL API error: ${response.status}`)
      }

      const parseStartedAt = monotonicNowMs()
      const result = (await response.json()) as WclQueryResult<T>
      const parseDurationMs = monotonicNowMs() - parseStartedAt
      const totalDurationMs = monotonicNowMs() - queryStartedAt

      if (result.errors?.length) {
        throw wclApiError(result.errors[0]?.message ?? 'Unknown GraphQL error')
      }
      if (!result.data) {
        throw wclApiError('No data returned from WCL API')
      }

      const isSlow = totalDurationMs >= 1000
      const logFn = isSlow ? console.warn : console.info

      logFn('[WCL] GraphQL query completed', {
        fetchDurationMs,
        operationName,
        parseDurationMs,
        queryLength: graphqlQuery.length,
        scope,
        status: response.status,
        tokenResolutionMs,
        totalDurationMs,
        variables: variableSummary,
      })

      return result.data
    } catch (error) {
      console.warn('[WCL] GraphQL query failed', {
        durationMs: monotonicNowMs() - queryStartedAt,
        error: toErrorLogMessage(error),
        operationName,
        queryLength: graphqlQuery.length,
        scope,
        status,
        tokenResolutionMs,
        variables: variableSummary,
      })
      throw error
    }
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
    const publicCacheKey = CacheKeys.report(code, 'public', undefined)

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
                id
                name
                faction {
                  id
                  name
                }
                server {
                  slug
                  region {
                    slug
                  }
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
    const variables = {
      code,
    }

    try {
      const clientData = await this.query<WCLReportResponse['data']>(
        query,
        variables,
      )
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
      variables,
      { accessToken: userAccessToken },
    )

    if (!userData.reportData.report) {
      throw wclApiError('Report not found')
    }

    await this.cacheReport(code, userData)
    return userData
  }

  private async cacheFightDetails(
    code: string,
    fightId: number,
    data: WclFightDetailsData,
  ): Promise<void> {
    const visibility = normalizeVisibility(data.reportData?.report?.visibility)
    const cacheKey = CacheKeys.fights(
      code,
      fightId,
      visibility,
      visibility === 'private' ? this.uid : undefined,
    )
    await this.cache.set(cacheKey, data)
  }

  /**
   * Get fight-scoped report metadata for /fights/:id.
   */
  async getFightDetails(
    code: string,
    fightId: number,
  ): Promise<WclFightDetailsData> {
    const privateCacheKey = CacheKeys.fights(code, fightId, 'private', this.uid)
    const publicCacheKey = CacheKeys.fights(code, fightId, 'public')

    const privateCached =
      await this.cache.get<WclFightDetailsData>(privateCacheKey)
    if (privateCached) {
      return privateCached
    }

    const publicCached =
      await this.cache.get<WclFightDetailsData>(publicCacheKey)
    if (publicCached) {
      return publicCached
    }

    const query = `
      query GetFightDetails($code: String!, $fightIDs: [Int!]) {
        reportData {
          report(code: $code) {
            code
            visibility
            fights(fightIDs: $fightIDs) {
              id
              encounterID
              name
              startTime
              endTime
              kill
              difficulty
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
              actors {
                id
                name
                type
                subType
                petOwner
              }
            }
            playerDetails(fightIDs: $fightIDs, includeCombatantInfo: false)
          }
        }
      }
    `
    const variables = {
      code,
      fightIDs: [fightId],
    }

    try {
      const clientData = await this.query<WclFightDetailsData>(query, variables)
      if (clientData.reportData?.report) {
        await this.cacheFightDetails(code, fightId, clientData)
        return clientData
      }
    } catch (error) {
      if (!shouldFallbackToUserToken(error)) {
        throw error
      }
      // A failed client-token query may indicate a private report. Fall through.
    }

    const userAccessToken = await this.getUserAccessToken()
    const userData = await this.query<WclFightDetailsData>(query, variables, {
      accessToken: userAccessToken,
    })
    if (!userData.reportData?.report) {
      throw wclApiError('Report not found')
    }

    await this.cacheFightDetails(code, fightId, userData)
    return userData
  }

  /** Resolve fight actor roles from fight-scoped player details. */
  async getFightPlayerRoles(
    code: string,
    fightId: number,
    visibility: unknown,
    friendlyPlayers: EncounterFriendlyPlayer[],
    options: { bypassCache?: boolean } = {},
  ): Promise<Map<number, ReportActorRole>> {
    if (friendlyPlayers.length === 0) {
      return new Map()
    }

    const { bypassCache = false } = options
    const normalizedVisibility = normalizeVisibility(visibility)
    const cacheKey = CacheKeys.fightPlayerRoles(
      code,
      fightId,
      normalizedVisibility,
      normalizedVisibility === 'private' ? this.uid : undefined,
    )
    const friendlyPlayerIds = new Set(
      friendlyPlayers.map((player) => player.id),
    )

    if (!bypassCache) {
      const cached = await this.cache.get<
        Array<{
          actorId: number
          role: ReportActorRole
        }>
      >(cacheKey)
      if (cached) {
        return new Map(
          cached
            .filter((entry) => friendlyPlayerIds.has(entry.actorId))
            .map((entry) => [entry.actorId, entry.role] as const),
        )
      }
    }

    const accessToken =
      normalizedVisibility === 'private'
        ? await this.getUserAccessToken()
        : undefined

    const query = `
      query GetFightPlayerDetails($code: String!, $fightIDs: [Int!], $includeCombatantInfo: Boolean) {
        reportData {
          report(code: $code) {
            playerDetails(
              fightIDs: $fightIDs
              includeCombatantInfo: $includeCombatantInfo
            )
          }
        }
      }
    `
    const data = await this.query<WclFightPlayerDetailsData>(
      query,
      {
        code,
        fightIDs: [fightId],
        includeCombatantInfo: false,
      },
      {
        accessToken,
      },
    )
    const actorRoles = resolveRolesFromPlayerDetails({
      friendlyPlayerIds,
      playerDetails: data.reportData?.report?.playerDetails,
    })

    await this.cache.set(
      cacheKey,
      [...actorRoles.entries()].map(([actorId, role]) => ({ actorId, role })),
    )

    return actorRoles
  }

  /** Get WCL GraphQL key usage details for the current hour. */
  async getRateLimitData(): Promise<WclRateLimitResponse> {
    const data = await this.query<WclRateLimitData>(
      `
        query GetRateLimitData {
          rateLimitData {
            limitPerHour
            pointsSpentThisHour
            pointsResetIn
          }
        }
      `,
      {},
      {
        scope: 'client',
      },
    )

    return parseWclRateLimitData(data)
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

  private async getGuildByIdentifier(
    accessToken: string | undefined,
    options: {
      guildId?: number
      guildName?: string
      serverSlug?: string
      serverRegion?: string
    },
  ): Promise<GuildWclReference> {
    const query = `
      query GuildLookup(
        $id: Int
        $name: String
        $serverSlug: String
        $serverRegion: String
      ) {
        guildData {
          guild(
            id: $id
            name: $name
            serverSlug: $serverSlug
            serverRegion: $serverRegion
          ) {
            id
            name
            faction {
              name
            }
            server {
              slug
              region {
                slug
                compactName
                name
              }
            }
          }
        }
      }
    `
    const data = await this.query<WclGuildLookupData>(
      query,
      {
        id: options.guildId ?? null,
        name: options.guildName ?? null,
        serverSlug: options.serverSlug ?? null,
        serverRegion: options.serverRegion ?? null,
      },
      {
        accessToken,
      },
    )
    const guild = data.guildData?.guild
    if (!guild) {
      throw wclApiError('Guild not found')
    }

    const guildReference = toGuildWclReference(guild)
    if (!guildReference) {
      throw wclApiError('Guild payload did not include required fields')
    }

    return guildReference
  }

  private async getRecentReportsByOwner(
    accessToken: string | undefined,
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

  /** Get recent reports for a specific guild. */
  async getGuildReports(options: {
    limit?: number
    guildId?: number
    guildName?: string
    serverSlug?: string
    serverRegion?: string
  }): Promise<GuildWclReports> {
    const boundedLimit = Math.min(
      Math.max(Math.trunc(options.limit ?? 10), 1),
      maxRecentReportsLimit,
    )
    const hasGuildLookupByName =
      typeof options.guildName === 'string' &&
      options.guildName.trim().length > 0 &&
      typeof options.serverSlug === 'string' &&
      options.serverSlug.trim().length > 0 &&
      typeof options.serverRegion === 'string' &&
      options.serverRegion.trim().length > 0
    const hasGuildId =
      typeof options.guildId === 'number' && Number.isFinite(options.guildId)

    if (!hasGuildId && !hasGuildLookupByName) {
      throw wclApiError(
        'Guild lookup requires guildId or guildName/serverSlug/serverRegion',
      )
    }

    const normalizedGuildId =
      hasGuildId && options.guildId !== undefined
        ? Math.trunc(options.guildId)
        : undefined
    const guildLookup = {
      guildId: normalizedGuildId,
      guildName: hasGuildLookupByName ? options.guildName?.trim() : undefined,
      serverSlug: hasGuildLookupByName ? options.serverSlug?.trim() : undefined,
      serverRegion: hasGuildLookupByName
        ? options.serverRegion?.trim()
        : undefined,
    }

    try {
      const guild = await this.getGuildByIdentifier(undefined, guildLookup)
      const reports = await this.getRecentReportsByOwner(
        undefined,
        {
          source: 'guild',
          guildId: guild.id,
        },
        boundedLimit,
      )

      return {
        guild,
        reports,
      }
    } catch (error) {
      if (!shouldFallbackToUserToken(error)) {
        throw error
      }
    }

    const accessToken = await this.getUserAccessToken()
    const guild = await this.getGuildByIdentifier(accessToken, guildLookup)
    const reports = await this.getRecentReportsByOwner(
      accessToken,
      {
        source: 'guild',
        guildId: guild.id,
      },
      boundedLimit,
    )

    return {
      guild,
      reports,
    }
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
    const cacheKey = CacheKeys.friendlyBuffBandsByFight(
      code,
      fightId,
      normalizedVisibility,
      normalizedVisibility === 'private' ? this.uid : undefined,
    )

    if (!bypassCache) {
      const cached = await this.cache.get<
        FriendlyBuffBandEntry[] | CachedFriendlyBuffBands
      >(cacheKey)
      if (cached) {
        const normalizedCache = parseCachedFriendlyBuffBands(cached)
        const fightStartAuras = filterFightStartAurasByFriendlies(
          normalizedCache.entries,
          fightStartTime,
          friendlyActorIds,
        )
        console.info('[WCL] Friendly buff bands cache hit', {
          code,
          fightId,
          source: normalizedCache.source,
          auraBandEntries: normalizedCache.entries.length,
          fightStartAuraActors: fightStartAuras.size,
          fightStartAuraIds: countFightStartAuraIdsByActor(fightStartAuras),
        })
        return fightStartAuras
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
      const fightStartAuras = filterFightStartAurasByFriendlies(
        resolvedBuffBands,
        fightStartTime,
        friendlyActorIds,
      )
      console.info('[WCL] Friendly buff bands fight-start aura extraction', {
        code,
        fightId,
        auraBandEntries: resolvedBuffBands.length,
        fightStartAuraActors: fightStartAuras.size,
        fightStartAuraIds: countFightStartAuraIdsByActor(fightStartAuras),
      })
      return fightStartAuras
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

    const reportRecord = data.reportData?.report
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
  async getEventsPage(
    code: string,
    fightId: number,
    visibility: unknown,
    startTime: number,
    endTime: number,
    options: { accessToken?: string; bypassCache?: boolean } = {},
  ): Promise<WclEventsPage> {
    const { accessToken: accessTokenOption, bypassCache = false } = options
    const normalizedVisibility = normalizeVisibility(visibility)
    const cacheKey = CacheKeys.eventsPage(
      code,
      fightId,
      normalizedVisibility,
      normalizedVisibility === 'private' ? this.uid : undefined,
      startTime,
      endTime,
    )

    if (!bypassCache) {
      const cached = await this.cache.get<WclEventsPage>(cacheKey)
      if (cached) {
        return cached
      }
    }

    const accessToken =
      accessTokenOption ??
      (normalizedVisibility === 'private'
        ? await this.getUserAccessToken()
        : undefined)

    const query = `
      query GetEvents($code: String!, $fightId: Int!, $startTime: Float, $endTime: Float) {
        reportData {
          report(code: $code) {
            events(
              fightIDs: [$fightId]
              startTime: $startTime
              endTime: $endTime
              limit: ${wclEventsPageLimit}
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
        startTime,
      },
      {
        accessToken,
      },
    )

    const page: WclEventsPage = {
      data: data.reportData.report.events.data,
      nextPageTimestamp: data.reportData.report.events.nextPageTimestamp,
    }
    await this.cache.set(cacheKey, page)

    return page
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
  ): Promise<WCLEvent[]> {
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
      const cached = await this.cache.get<WCLEvent[]>(cacheKey)
      if (cached) {
        return cached
      }
    }

    const allEvents: WCLEvent[] = []
    let requestStartTime = startTime
    const accessToken =
      normalizedVisibility === 'private'
        ? await this.getUserAccessToken()
        : undefined

    while (true) {
      const page = await this.getEventsPage(
        code,
        fightId,
        visibility,
        requestStartTime ?? startTime ?? 0,
        endTime ?? Number.MAX_SAFE_INTEGER,
        {
          accessToken,
          bypassCache,
        },
      )
      allEvents.push(...page.data)

      if (!page.nextPageTimestamp) {
        break
      }
      requestStartTime = page.nextPageTimestamp
    }

    if (allEvents.length <= maxCacheableWclEvents) {
      await this.cache.set(cacheKey, allEvents)
    } else {
      console.info('[WCL] Skipping raw events cache for large payload', {
        code,
        eventCount: allEvents.length,
        fightId,
        maxCacheableWclEvents,
      })
    }
    return allEvents
  }
}
