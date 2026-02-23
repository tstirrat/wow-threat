/**
 * API Contract Transformers
 *
 * Normalizes WCL response models into frontend-facing API contract types.
 */
import type {
  ReportAbility,
  ReportActor,
  ReportFight,
} from '@wow-threat/wcl-types'

import type {
  ReportAbilitySummary,
  ReportActorSummary,
  ReportFightParticipant,
  ReportFightSummary,
} from './api'

/** Convert a WCL actor to a stable frontend-facing actor summary. */
export function toReportActorSummary(actor: ReportActor): ReportActorSummary {
  if (actor.type === 'Pet') {
    return {
      id: actor.id,
      gameID: actor.gameID,
      name: actor.name,
      type: actor.type,
      petOwner: actor.petOwner,
    }
  }

  return {
    id: actor.id,
    gameID: actor.gameID,
    name: actor.name,
    type: actor.type,
    subType: actor.subType,
  }
}

/** Convert a WCL ability to a stable frontend-facing ability summary. */
export function toReportAbilitySummary(
  ability: ReportAbility,
): ReportAbilitySummary {
  return {
    gameID: ability.gameID,
    icon: ability.icon,
    name: ability.name,
    type: ability.type,
  }
}

/** Convert a WCL fight participant entry to a frontend-facing shape. */
export function toReportFightParticipant(
  participant: ReportFight['enemyNPCs'][number],
): ReportFightParticipant {
  return {
    id: participant.id,
    gameID: participant.gameID,
    instanceCount: participant.instanceCount,
    groupCount: participant.groupCount,
    petOwner: participant.petOwner ?? null,
  }
}

/** Convert a WCL fight into a stable frontend-facing fight summary. */
export function toReportFightSummary(fight: ReportFight): ReportFightSummary {
  return {
    id: fight.id,
    encounterID: fight.encounterID ?? null,
    classicSeasonID: fight.classicSeasonID ?? null,
    name: fight.name,
    startTime: fight.startTime,
    endTime: fight.endTime,
    kill: fight.kill,
    difficulty: fight.difficulty,
    bossPercentage: fight.bossPercentage,
    fightPercentage: fight.fightPercentage,
    enemyNPCs: fight.enemyNPCs.map(toReportFightParticipant),
    enemyPets: fight.enemyPets.map(toReportFightParticipant),
    friendlyPlayers: fight.friendlyPlayers,
    friendlyPets: fight.friendlyPets.map(toReportFightParticipant),
  }
}
