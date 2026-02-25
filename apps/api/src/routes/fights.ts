/**
 * Fights Routes
 *
 * GET /reports/:code/fights/:id - Get fight details
 */
import { exists } from '@wow-threat/shared'
import type { ReportActor } from '@wow-threat/wcl-types'
import { Hono } from 'hono'

import {
  fightNotFound,
  invalidFightId,
  reportNotFound,
  unauthorized,
} from '../middleware/error'
import { normalizeVisibility } from '../services/cache'
import { WCLClient, resolveFightActorRoles } from '../services/wcl'
import type { FightsResponse, ReportActorRole } from '../types/api'
import { toReportActorSummary } from '../types/api-transformers'
import type { Bindings, Variables } from '../types/bindings'
import { eventsRoutes } from './events'

export const fightsRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

export type { FightsResponse } from '../types/api'

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

  const uid = c.get('uid')
  if (!uid) {
    throw unauthorized('Missing authenticated uid context')
  }

  const wcl = new WCLClient(c.env, uid)
  const data = await wcl.getFightDetails(code, fightId)

  if (!data?.reportData?.report) {
    throw reportNotFound(code)
  }

  const report = data.reportData.report
  const visibility = normalizeVisibility(report.visibility)

  // Find the specific fight
  const fight = report.fights.find((f) => f.id === fightId)
  if (!fight) {
    throw fightNotFound(code, fightId)
  }

  // Get actors relevant to this fight
  const masterData = report.masterData

  // Build a lookup map for faster actor resolution
  const reportActors = new Map(masterData.actors.map((a) => [a.id, a]))
  const reportActorRoles = resolveFightActorRoles(report, fight.id)
  const friendlyPlayers = masterData.actors.flatMap((actor) =>
    actor.type === 'Player' && (fight.friendlyPlayers ?? []).includes(actor.id)
      ? [
          {
            id: actor.id,
            name: actor.name,
          },
        ]
      : [],
  )
  const encounterActorRoles =
    reportActorRoles.size > 0
      ? new Map<number, ReportActorRole>()
      : await wcl.getEncounterActorRoles(
          code,
          fight.encounterID ?? null,
          fight.id,
          visibility,
          friendlyPlayers,
        )
  const actorRoles = new Map<number, ReportActorRole>([
    ...reportActorRoles.entries(),
    ...encounterActorRoles.entries(),
  ])

  // Build actors from fight participants
  const petActors = (fight.friendlyPets ?? [])
    .map((pet) => reportActors.get(pet.id))
    .filter(exists)

  const actors = (fight.friendlyPlayers ?? [])
    .map((id) => reportActors.get(id))
    .filter(exists)
    .concat(petActors)
    .map((actor: ReportActor) =>
      toReportActorSummary(actor, actorRoles.get(actor.id)),
    )

  // Build enemies from fight-level enemyNPCs + enemyPets
  const enemyGameIdByActorId = new Map(
    [...(fight.enemyNPCs ?? []), ...(fight.enemyPets ?? [])].map((enemy) => [
      enemy.id,
      enemy.gameID,
    ]),
  )
  const enemies = [...(fight.enemyNPCs ?? []), ...(fight.enemyPets ?? [])]
    .map((npc) => reportActors.get(npc.id))
    .filter(exists)
    .map((enemy: ReportActor) => {
      const summary = toReportActorSummary(enemy)

      return {
        ...summary,
        gameID: summary.gameID ?? enemyGameIdByActorId.get(enemy.id),
      }
    })

  const cacheControl =
    c.env.ENVIRONMENT === 'development'
      ? 'no-store, no-cache, must-revalidate'
      : visibility === 'public'
        ? 'public, max-age=31536000, immutable'
        : 'private, no-store'

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
