/**
 * Reports Routes
 *
 * GET /reports/:code - Get report metadata
 */
import type {
  ReportActor as WCLReportActor,
  ReportFight as WCLReportFight,
  Zone as WCLZone,
} from '@wcl-threat/wcl-types'
import { Hono } from 'hono'

import { invalidReportCode, reportNotFound } from '../middleware/error'
import { WCLClient } from '../services/wcl'
import type { Bindings, Variables } from '../types/bindings'
import { fightsRoutes } from './fights'

// Report code format: alphanumeric + hyphens, typically 16 chars
const REPORT_CODE_REGEX = /^[a-zA-Z0-9-]+$/

export const reportRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

export interface ReportResponse {
  code: string
  title: string
  owner: string
  startTime: number
  endTime: number
  gameVersion: number
  zone: WCLZone
  fights: WCLReportFight[]
  actors: WCLReportActor[]
}

/**
 * GET /reports/:code
 * Returns report metadata including fights and actors
 */
reportRoutes.get('/:code', async (c) => {
  const code = c.req.param('code')

  // Validate report code format
  if (!code || !REPORT_CODE_REGEX.test(code)) {
    throw invalidReportCode(code || 'empty')
  }

  const wcl = new WCLClient(c.env)
  const data = await wcl.getReport(code)

  if (!data?.reportData?.report) {
    throw reportNotFound(code)
  }

  const report = data.reportData.report
  const masterData = report.masterData

  const cacheControl =
    c.env.ENVIRONMENT === 'development'
      ? 'no-store, no-cache, must-revalidate'
      : 'public, max-age=31536000, immutable'

  return c.json<ReportResponse>(
    {
      code: report.code,
      title: report.title,
      owner: report.owner.name,
      startTime: report.startTime,
      endTime: report.endTime,
      gameVersion: masterData.gameVersion,
      zone: report.zone,
      fights: report.fights,
      actors: masterData.actors,
    },
    200,
    {
      'Cache-Control': cacheControl,
    },
  )
})

// Mount fight routes under /reports/:code/fights
reportRoutes.route('/:code/fights', fightsRoutes)
