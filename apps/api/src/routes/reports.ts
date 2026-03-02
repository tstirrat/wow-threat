/**
 * Reports Routes
 *
 * GET /reports/entities/:entityType/reports - Get reports for an entity (guild)
 * GET /reports/recent - Get merged personal + guild recent reports
 * GET /reports/:code - Get report metadata
 */
import { resolveConfigOrNull } from '@wow-threat/config'
import { immutableApiCacheVersions } from '@wow-threat/shared'
import type {
  ReportAbility as WCLReportAbility,
  ReportActor as WCLReportActor,
  ReportFight as WCLReportFight,
} from '@wow-threat/wcl-types'
import { Hono } from 'hono'

import {
  AppError,
  invalidReportCode,
  reportNotFound,
  unauthorized,
} from '../middleware/error'
import { normalizeVisibility } from '../services/cache'
import { WCLClient } from '../services/wcl'
import type { ReportResponse } from '../types/api'
import {
  toReportAbilitySummary,
  toReportActorSummary,
  toReportFightSummary,
} from '../types/api-transformers'
import type { Bindings, Variables } from '../types/bindings'
import { fightsRoutes } from './fights'

// Report code format: alphanumeric + hyphens, typically 16 chars
const REPORT_CODE_REGEX = /^[a-zA-Z0-9-]+$/
const defaultRecentReportsLimit = 10

export const reportRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

export type {
  EntityReportsResponse,
  RecentReportsResponse,
  ReportResponse,
} from '../types/api'

/**
 * GET /reports/entities/:entityType/reports
 * Returns recent reports for a specific entity (guild currently supported).
 */
reportRoutes.get('/entities/:entityType/reports', async (c) => {
  const uid = c.get('uid')
  if (!uid) {
    throw unauthorized('Missing authenticated uid context')
  }

  const entityType = c.req.param('entityType')
  if (entityType !== 'guild') {
    throw new AppError(
      'INVALID_ENTITY_TYPE',
      `Unsupported entity type: ${entityType}`,
      400,
    )
  }

  const requestedLimit = c.req.query('limit')
  const parsedLimit = requestedLimit ? Number.parseInt(requestedLimit, 10) : NaN
  const limit = Number.isFinite(parsedLimit)
    ? parsedLimit
    : defaultRecentReportsLimit

  const guildIdParam = c.req.query('guildId')
  const parsedGuildId = guildIdParam ? Number.parseInt(guildIdParam, 10) : NaN
  const guildId = Number.isFinite(parsedGuildId) ? parsedGuildId : undefined
  const guildName = c.req.query('guildName')?.trim()
  const serverSlug = c.req.query('serverSlug')?.trim()
  const serverRegion = c.req.query('serverRegion')?.trim()
  const hasGuildLookupByName =
    Boolean(guildName) && Boolean(serverSlug) && Boolean(serverRegion)

  if (guildId === undefined && !hasGuildLookupByName) {
    throw new AppError(
      'INVALID_ENTITY_LOOKUP',
      'Guild lookup requires guildId or guildName/serverSlug/serverRegion',
      400,
    )
  }

  const wcl = new WCLClient(c.env, uid)
  const guildReports = await wcl.getGuildReports({
    limit,
    guildId,
    guildName,
    serverSlug,
    serverRegion,
  })

  return c.json(
    {
      entityType: 'guild',
      entity: guildReports.guild,
      reports: guildReports.reports.map((report) => ({
        code: report.code,
        title: report.title,
        startTime: report.startTime,
        endTime: report.endTime,
        zoneName: report.zoneName,
        guildName: report.guildName,
        guildFaction: report.guildFaction,
      })),
    },
    200,
    {
      'Cache-Control': 'private, no-store',
    },
  )
})

/**
 * GET /reports/recent
 * Returns merged personal + guild recent logs for the authenticated user.
 */
reportRoutes.get('/recent', async (c) => {
  const uid = c.get('uid')
  if (!uid) {
    throw unauthorized('Missing authenticated uid context')
  }
  const wclUserId = c.get('wclUserId')
  if (!wclUserId) {
    throw unauthorized('Sign in with Warcraft Logs for personal reports')
  }

  const requestedLimit = c.req.query('limit')
  const parsedLimit = requestedLimit ? Number.parseInt(requestedLimit, 10) : NaN
  const limit = Number.isFinite(parsedLimit)
    ? parsedLimit
    : defaultRecentReportsLimit

  const wcl = new WCLClient(c.env, uid)
  const reports = await wcl.getRecentReports(limit)

  return c.json(
    {
      reports,
    },
    200,
    {
      'Cache-Control': 'private, no-store',
    },
  )
})

/**
 * GET /reports/:code
 * Returns report metadata including fights, actors, and abilities
 */
reportRoutes.get('/:code', async (c) => {
  const code = c.req.param('code')
  const cacheVersionParam = c.req.query('cv')
  const isVersionedRequest =
    cacheVersionParam === immutableApiCacheVersions.report

  // Validate report code format
  if (!code || !REPORT_CODE_REGEX.test(code)) {
    throw invalidReportCode(code || 'empty')
  }

  const uid = c.get('uid')
  if (!uid) {
    throw unauthorized('Missing authenticated uid context')
  }

  const wcl = new WCLClient(c.env, uid)
  const data = await wcl.getReport(code)

  if (!data?.reportData?.report) {
    throw reportNotFound(code)
  }

  const report = data.reportData.report
  const visibility = normalizeVisibility(report.visibility)
  const threatConfig = resolveConfigOrNull({
    report,
  })
  const masterData = report.masterData

  const cacheControl =
    c.env.ENVIRONMENT === 'development'
      ? 'no-store, no-cache, must-revalidate'
      : visibility === 'public'
        ? isVersionedRequest
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, must-revalidate'
        : 'private, no-store'

  return c.json<ReportResponse>(
    {
      code: report.code,
      title: report.title,
      visibility,
      owner: report.owner.name,
      guild: report.guild
        ? {
            id:
              typeof report.guild.id === 'number' &&
              Number.isFinite(report.guild.id)
                ? report.guild.id
                : null,
            name: report.guild.name,
            faction:
              typeof report.guild.faction === 'string'
                ? report.guild.faction
                : report.guild.faction.name,
            serverSlug:
              typeof report.guild.server?.slug === 'string'
                ? report.guild.server.slug
                : null,
            serverRegion:
              typeof report.guild.server?.region?.slug === 'string'
                ? report.guild.server.region.slug
                : null,
          }
        : null,
      archiveStatus: report.archiveStatus
        ? {
            isArchived: report.archiveStatus.isArchived ?? false,
            isAccessible: report.archiveStatus.isAccessible ?? true,
            archiveDate: report.archiveStatus.archiveDate ?? null,
          }
        : null,
      startTime: report.startTime,
      endTime: report.endTime,
      gameVersion: masterData.gameVersion,
      threatConfig: threatConfig
        ? {
            displayName: threatConfig.displayName,
            version: threatConfig.version,
          }
        : null,
      zone: report.zone,
      fights: report.fights.map((fight: WCLReportFight) =>
        toReportFightSummary(fight),
      ),
      actors: masterData.actors.map((actor: WCLReportActor) =>
        toReportActorSummary(actor),
      ),
      abilities: (masterData.abilities ?? []).map((ability: WCLReportAbility) =>
        toReportAbilitySummary(ability),
      ),
    },
    200,
    {
      'Cache-Control': cacheControl,
      'X-Cache-Version': immutableApiCacheVersions.report,
    },
  )
})

// Mount fight routes under /reports/:code/fights
reportRoutes.route('/:code/fights', fightsRoutes)
