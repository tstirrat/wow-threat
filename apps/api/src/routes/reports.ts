/**
 * Reports Routes
 *
 * GET /reports/:code - Get report metadata
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../types/bindings'
import { WCLClient } from '../services/wcl'
import { invalidReportCode, reportNotFound } from '../middleware/error'
import { fightsRoutes } from './fights'

// Report code format: alphanumeric + hyphens, typically 16 chars
const REPORT_CODE_REGEX = /^[a-zA-Z0-9-]+$/

export const reportRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

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

  // Categorize actors
  const players = masterData.actors.filter((a) => a.type === 'Player')
  const enemies = masterData.actors.filter((a) => a.type === 'NPC' || a.type === 'Boss')
  const pets = masterData.actors.filter((a) => a.type === 'Pet')

  return c.json(
    {
      code: report.code,
      title: report.title,
      owner: report.owner.name,
      startTime: report.startTime,
      endTime: report.endTime,
      gameVersion: masterData.gameVersion,
      zone: report.zone,
      fights: report.fights,
      actors: {
        players,
        enemies,
        pets,
      },
    },
    200,
    {
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
  )
})

// Mount fight routes under /reports/:code/fights
reportRoutes.route('/:code/fights', fightsRoutes)
