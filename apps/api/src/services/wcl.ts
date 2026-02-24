/**
 * Warcraft Logs API client with visibility-aware caching and private token support.
 */
import type {
  Report,
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

interface WclReportRankingsCharacter {
  id?: number | string | null
  name?: string | null
}

interface WclReportRankingsRoleGroup {
  characters?: Array<WclReportRankingsCharacter | null> | null
}

interface WclReportRankingsRoles {
  tanks?: WclReportRankingsRoleGroup | null
  healers?: WclReportRankingsRoleGroup | null
  dps?: WclReportRankingsRoleGroup | null
}

interface WclReportRankingEntry {
  encounterID?: number | string | null
  encounterId?: number | string | null
  fightID?: number | string | null
  fightId?: number | string | null
  roles?: WclReportRankingsRoles | null
}

interface WclReportRankingsData {
  reportData?: {
    report?: {
      rankings?: unknown
    } | null
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

interface EncounterRankingTarget {
  encounterId: number | null
  fightId: number | null
}

interface EncounterFriendlyPlayer {
  id: number
  name: string
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

function parseReportRankingCharacters(
  value: unknown,
): Array<WclReportRankingsCharacter | null> {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((character) => {
    if (!character || typeof character !== 'object') {
      return []
    }

    const record = character as Record<string, unknown>
    const id = parseNumericId(record.id)
    const name = typeof record.name === 'string' ? record.name : null

    return [{ id, name }]
  })
}

function parseReportRankingRoleGroups(
  value: unknown,
): WclReportRankingsRoles | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const parseRoleGroup = (
    roleValue: unknown,
  ): WclReportRankingsRoleGroup | null => {
    if (!roleValue || typeof roleValue !== 'object') {
      return null
    }

    const roleRecord = roleValue as Record<string, unknown>
    const rawCharacters = roleRecord.characters
    const characters = parseReportRankingCharacters(rawCharacters)
    if (characters.length === 0) {
      return null
    }

    return { characters }
  }

  const tanks = parseRoleGroup(record.tanks)
  const healers = parseRoleGroup(record.healers)
  const dps = parseRoleGroup(record.dps)
  if (!tanks && !healers && !dps) {
    return null
  }

  return {
    tanks: tanks ?? null,
    healers: healers ?? null,
    dps: dps ?? null,
  }
}

function parseReportRankingEntry(value: unknown): WclReportRankingEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const encounterID = parseNumericId(
    record.encounterID ?? record.encounterId,
  )
  const fightID = parseNumericId(record.fightID ?? record.fightId)
  const roles = parseReportRankingRoleGroups(record.roles)

  const hasRoles = roles !== null
  if (!hasRoles && encounterID === null && fightID === null) {
    return null
  }

  return {
    encounterID,
    encounterId: encounterID,
    fightID,
    fightId: fightID,
    roles: roles ?? undefined,
  }
}

function parseReportRankings(value: unknown): WclReportRankingEntry[] {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      const normalized = parseReportRankingEntry(entry)
      return normalized === null ? [] : [normalized]
    })
  }

  if (typeof value !== 'object') {
    return []
  }

  const normalized = parseReportRankingEntry(value)
  if (normalized !== null) {
    return [normalized]
  }

  return Object.values(value as Record<string, unknown>).flatMap((nestedValue) => {
    return parseReportRankings(nestedValue)
  })
}

function buildFriendlyPlayerIdsByNormalizedName(
  friendlyPlayers: EncounterFriendlyPlayer[],
): Map<string, Set<number>> {
  return friendlyPlayers.reduce((map, player) => {
    const normalizedName = player.name.toLowerCase().trim()
    if (normalizedName.length === 0) {
      return map
    }

    const actorIds = map.get(normalizedName) ?? new Set<number>()
    actorIds.add(player.id)
    map.set(normalizedName, actorIds)
    return map
  }, new Map<string, Set<number>>())
}

function buildFriendlyPlayerIdsByNameFromEntries(
  friendlyPlayers: EncounterFriendlyPlayer[],
): Map<string, Set<number>> {
  return buildFriendlyPlayerIdsByNormalizedName(friendlyPlayers)
}

function parseRoleEntriesToActorRoles({
  rankingEntries,
  encounterTarget,
  reportActorNameLookup,
  friendlyPlayerIds,
}: {
  rankingEntries: WclReportRankingEntry[]
  encounterTarget: EncounterRankingTarget
  reportActorNameLookup: Map<string, Set<number>>
  friendlyPlayerIds: Set<number>
}): Map<number, ReportActorRole> {
  return rankingEntries.reduce((actorRoles, rankingEntry) => {
    if (!rankingEntry) {
      return actorRoles
    }

    const rankingFightId = parseNumericId(
      rankingEntry.fightID ?? rankingEntry.fightId,
    )
    const rankingEncounterId = parseNumericId(
      rankingEntry.encounterID ?? rankingEntry.encounterId,
    )
    if (
      rankingFightId !== null &&
      rankingFightId !== encounterTarget.fightId
    ) {
      return actorRoles
    }
    if (
      encounterTarget.encounterId !== null &&
      rankingEncounterId !== null &&
      rankingEncounterId !== encounterTarget.encounterId
    ) {
      return actorRoles
    }

    const rolesByBucket: Array<[
      'Tank' | 'Healer' | 'DPS',
      WclReportRankingsRoleGroup | null | undefined,
    ]> = [
      ['Tank', rankingEntry.roles?.tanks],
      ['Healer', rankingEntry.roles?.healers],
      ['DPS', rankingEntry.roles?.dps],
    ]

    rolesByBucket.forEach(([role, roleBucket]) => {
      if (!Array.isArray(roleBucket?.characters)) {
        return
      }

      roleBucket.characters.forEach((character) => {
        parseReportRankingCharacterActorIds(
          character,
          reportActorNameLookup,
          friendlyPlayerIds,
        ).forEach((actorId) => {
          actorRoles.set(actorId, role)
        })
      })
    })

    return actorRoles
  }, new Map<number, ReportActorRole>())
}

function buildFriendlyPlayerIdsByName(
  reportActors: Map<number, Report['masterData']['actors'][number]>,
  friendlyPlayerIds: Set<number>,
): Map<string, Set<number>> {
  return [...friendlyPlayerIds].reduce((map, actorId) => {
    const actor = reportActors.get(actorId)
    if (!actor || actor.type !== 'Player' || !actor.name) {
      return map
    }

    const normalizedName = actor.name.toLowerCase().trim()
    const actorIds = map.get(normalizedName) ?? new Set()
    actorIds.add(actorId)
    map.set(normalizedName, actorIds)
    return map
  }, new Map<string, Set<number>>())
}

function parseReportRankingCharacterActorIds(
  character: WclReportRankingsCharacter | null | undefined,
  reportActorNameLookup: Map<string, Set<number>>,
  friendlyPlayerIds: Set<number>,
): Set<number> {
  const actorIds = new Set<number>()
  const actorId = parseNumericId(character?.id)
  if (actorId !== null && friendlyPlayerIds.has(actorId)) {
    actorIds.add(actorId)
  }

  const normalizedName = character?.name?.toLowerCase().trim()
  if (normalizedName) {
    reportActorNameLookup
      .get(normalizedName)
      ?.forEach((matchingActorId) => actorIds.add(matchingActorId))
  }

  return actorIds
}

function resolveFightActorRolesFromReportRankings(
  report: Report,
  fightId: number,
): Map<number, ReportActorRole> {
  const fight = report.fights.find((entry) => entry.id === fightId)
  if (!fight) {
    return new Map()
  }

  const encounterTarget: EncounterRankingTarget = {
    encounterId: fight.encounterID ?? null,
    fightId,
  }
  const friendlyPlayerIds = new Set(fight.friendlyPlayers ?? [])
  const reportActors = new Map(
    report.masterData.actors.map((actor) => [actor.id, actor]),
  )
  const reportActorNameLookup = buildFriendlyPlayerIdsByName(
    reportActors,
    friendlyPlayerIds,
  )
  return parseRoleEntriesToActorRoles({
    rankingEntries: parseReportRankings(report.rankings),
    encounterTarget,
    reportActorNameLookup,
    friendlyPlayerIds,
  })
}

/** Resolve fight actor roles from report encounter ranking metadata. */
export function resolveFightActorRoles(
  report: Report,
  fightId: number,
): Map<number, ReportActorRole> {
  return resolveFightActorRolesFromReportRankings(report, fightId)
}

/** Resolve fight tank actor IDs from report ranking metadata. */
export function resolveFightTankActorIds(
  report: Report,
  fightId: number,
): Set<number> {
  const tankActorIds = new Set<number>()
  for (const [actorId, role] of resolveFightActorRoles(report, fightId)) {
    if (role === 'Tank') {
      tankActorIds.add(actorId)
    }
  }
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

  /** Resolve fight actor roles from encounter rankings for a specific fight. */
  async getEncounterActorRoles(
    code: string,
    encounterId: number | null,
    fightId: number,
    visibility: unknown,
    friendlyPlayers: EncounterFriendlyPlayer[],
    options: { bypassCache?: boolean } = {},
  ): Promise<Map<number, ReportActorRole>> {
    if (encounterId === null || friendlyPlayers.length === 0) {
      return new Map()
    }

    const { bypassCache = false } = options
    const normalizedVisibility = normalizeVisibility(visibility)
    const cacheKey = CacheKeys.encounterActorRoles(
      code,
      encounterId,
      fightId,
      normalizedVisibility,
      normalizedVisibility === 'private' ? this.uid : undefined,
    )
    const friendlyPlayerIds = new Set(friendlyPlayers.map((player) => player.id))

    if (!bypassCache) {
      const cached = await this.cache.get<Array<{
        actorId: number
        role: ReportActorRole
      }>>(cacheKey)
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
      query GetEncounterActorRoles($code: String!, $encounterID: Int!, $fightIDs: [Int!]) {
        reportData {
          report(code: $code) {
            rankings(encounterID: $encounterID, fightIDs: $fightIDs)
          }
        }
      }
    `
    const data = await this.query<WclReportRankingsData>(
      query,
      {
        code,
        encounterID: encounterId,
        fightIDs: [fightId],
      },
      {
        accessToken,
      },
    )

    const actorRoles = parseRoleEntriesToActorRoles({
      rankingEntries: parseReportRankings(data.reportData?.report?.rankings),
      encounterTarget: {
        encounterId,
        fightId,
      },
      reportActorNameLookup: buildFriendlyPlayerIdsByNameFromEntries(
        friendlyPlayers,
      ),
      friendlyPlayerIds,
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
