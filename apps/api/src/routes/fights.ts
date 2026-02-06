/**
 * Fights Routes
 *
 * GET /reports/:code/fights/:id - Get fight details
 */
import { exists } from '@wcl-threat/shared'
import type { ReportActor } from '@wcl-threat/wcl-types'
import { Hono } from 'hono'

import {
  fightNotFound,
  invalidFightId,
  reportNotFound,
} from '../middleware/error'
import { WCLClient } from '../services/wcl'
import type { Bindings, Variables } from '../types/bindings'
import { eventsRoutes } from './events'

export const fightsRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

export interface FightsResponse {
  id: number
  reportCode: string
  name: string
  startTime: number
  endTime: number
  kill: boolean
  difficulty: number | null
  enemies: ReportActor[]
  actors: ReportActor[]
}

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

  // Build a lookup map for faster actor resolution
  const reportActors = new Map(masterData.actors.map((a) => [a.id, a]))

  // Build actors from fight participants
  const petActors = (fight.friendlyPets ?? [])
    .map((pet) => reportActors.get(pet.id))
    .filter(exists)

  const actors = (fight.friendlyPlayers ?? [])
    .map((id) => reportActors.get(id))
    .filter(exists)
    .concat(petActors)

  // Build enemies from fight-level enemyNPCs + enemyPets
  const enemies = [...(fight.enemyNPCs ?? []), ...(fight.enemyPets ?? [])]
    .map((npc) => reportActors.get(npc.id))
    .filter(exists)

  const cacheControl =
    c.env.ENVIRONMENT === 'development'
      ? 'no-store, no-cache, must-revalidate'
      : 'public, max-age=31536000, immutable'

  return c.json<FightsResponse>(
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
    },
    200,
    {
      'Cache-Control': cacheControl,
    },
  )
})

// Mount events routes under /reports/:code/fights/:id/events
fightsRoutes.route('/:id/events', eventsRoutes)
