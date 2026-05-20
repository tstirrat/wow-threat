/**
 * API Contract Transformers
 *
 * Normalizes WCL response models into frontend-facing API contract types.
 */
import type { ThreatConfig } from '@wow-threat/shared'
import type {
  ReportAbility,
  ReportActor,
  ReportArchiveStatus,
  ReportFight,
  ReportGuild,
} from '@wow-threat/wcl-types'

import type {
  ReportAbilitySummary,
  ReportActorRole,
  ReportActorSummary,
  ReportArchiveStatusSummary,
  ReportFightParticipant,
  ReportFightSummary,
  ReportGuildSummary,
  ThreatConfigSummary,
} from './api'

/** Convert a WCL actor to a stable frontend-facing actor summary. */
export function toReportActorSummary(
  actor: ReportActor,
  options: {
    role?: ReportActorRole
    spec?: string
  } = {},
): ReportActorSummary {
  const { role, spec } = options

  if (actor.type === 'Pet') {
    return {
      id: actor.id,
      gameID: actor.gameID,
      name: actor.name,
      type: actor.type,
      petOwner: actor.petOwner,
      ...(role ? { role } : {}),
    }
  }

  return {
    id: actor.id,
    gameID: actor.gameID,
    name: actor.name,
    type: actor.type,
    subType: actor.subType,
    ...(spec ? { spec } : {}),
    ...(role ? { role } : {}),
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

/** Convert a WCL guild to a stable frontend-facing guild summary. */
export function toReportGuildSummary(guild: ReportGuild): ReportGuildSummary {
  return {
    id:
      typeof guild.id === 'number' && Number.isFinite(guild.id)
        ? guild.id
        : null,
    name: guild.name,
    faction:
      typeof guild.faction === 'string' ? guild.faction : guild.faction.name,
    serverSlug:
      typeof guild.server?.slug === 'string' ? guild.server.slug : null,
    serverRegion:
      typeof guild.server?.region?.slug === 'string'
        ? guild.server.region.slug
        : null,
  }
}

/** Convert a WCL archive status to a stable frontend-facing summary. */
export function toReportArchiveStatusSummary(
  archiveStatus: ReportArchiveStatus,
): ReportArchiveStatusSummary {
  return {
    isArchived: archiveStatus.isArchived ?? false,
    isAccessible: archiveStatus.isAccessible ?? true,
    archiveDate: archiveStatus.archiveDate ?? null,
  }
}

/** Convert a ThreatConfig to a stable frontend-facing summary. */
export function toThreatConfigSummary(
  config: ThreatConfig,
): ThreatConfigSummary {
  return {
    displayName: config.displayName,
    version: config.version,
  }
}
