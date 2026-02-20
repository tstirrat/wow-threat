/**
 * Reports Routes
 *
 * GET /reports/:code - Get report metadata
 */
import { resolveConfigOrNull } from '@wow-threat/config'
import type {
  ReportAbility as WCLReportAbility,
  ReportActor as WCLReportActor,
  ReportFight as WCLReportFight,
} from '@wow-threat/wcl-types'
import { Hono } from 'hono'

import {
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

export const reportRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

export type { ReportResponse } from '../types/api'

/**
 * GET /reports/:code
 * Returns report metadata including fights, actors, and abilities
 */
reportRoutes.get('/:code', async (c) => {
  const code = c.req.param('code')

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
        ? 'public, max-age=31536000, immutable'
        : 'private, no-store'

  return c.json<ReportResponse>(
    {
      code: report.code,
      title: report.title,
      visibility,
      owner: report.owner.name,
      guild: report.guild
        ? {
            name: report.guild.name,
            faction:
              typeof report.guild.faction === 'string'
                ? report.guild.faction
                : report.guild.faction.name,
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
    },
  )
})

// Mount fight routes under /reports/:code/fights
reportRoutes.route('/:code/fights', fightsRoutes)
