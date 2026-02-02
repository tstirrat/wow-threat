/**
 * Fights Routes
 *
 * GET /reports/:code/fights/:id - Get fight details
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../types/bindings'
import { WCLClient } from '../services/wcl'
import { invalidFightId, fightNotFound, reportNotFound } from '../middleware/error'
import { eventsRoutes } from './events'

export const fightsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * GET /reports/:code/fights/:id
 * Returns detailed fight information
 */
fightsRoutes.get('/:id', async (c) => {
  const code = c.req.param('code')!
  const idParam = c.req.param('id')!

  // Validate fight ID
  const fightId = parseInt(idParam, 10)
  if (Number.isNaN(fightId)) {
    throw invalidFightId(idParam)
  }

  const wcl = new WCLClient(c.env)
  const data = await wcl.getReport(code)

  if (!data?.reportData?.report) {
    throw reportNotFound(code)
  }

  const report = data.reportData.report

  // Find the specific fight
  const fight = report.fights.find((f) => f.id === fightId)
  if (!fight) {
    throw fightNotFound(code, fightId)
  }

  // Get actors relevant to this fight
  const masterData = report.masterData
  const actors = masterData.actors.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as 'Player' | 'Pet' | 'Guardian' | 'Companion',
    class: a.type === 'Player' ? a.subType : null,
    spec: null, // Would need combatantinfo events
    role: null, // Would need combatantinfo events
    petOwner: a.petOwner,
  }))

  // Get enemies (NPCs in this fight)
  const enemies = masterData.actors
    .filter((a) => a.type === 'NPC' || a.type === 'Boss')
    .map((a) => ({
      id: a.id,
      guid: 0, // Would need additional WCL query for GUID
      name: a.name,
      instanceCount: 1,
      type: a.type === 'Boss' ? 'Boss' : ('Add' as 'Boss' | 'Add' | 'Trash'),
    }))

  return c.json(
    {
      id: fight.id,
      reportCode: code,
      name: fight.name,
      startTime: fight.startTime,
      endTime: fight.endTime,
      kill: fight.kill,
      difficulty: fight.difficulty,
      enemies,
      actors,
      phases: [], // Would need phase data from WCL
    },
    200,
    {
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
  )
})

// Mount events routes under /reports/:code/fights/:id/events
fightsRoutes.route('/:id/events', eventsRoutes)
