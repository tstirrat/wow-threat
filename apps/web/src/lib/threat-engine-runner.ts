/**
 * Shared core threat-engine execution pipeline used by both the main-thread
 * fallback path and the dedicated Web Worker.
 */
import {
  type ThreatConfigId,
  getThreatConfigById,
  resolveConfigOrNull,
} from '@wow-threat/config'
import {
  type ActorAuraOverrides,
  type ThreatEngine,
  buildThreatEngineInput,
} from '@wow-threat/engine'
import {
  deserializeInitialAurasByActor,
  serializeInitialAurasByActor,
} from '@wow-threat/shared'
import type { Report, WCLEvent } from '@wow-threat/wcl-types'

import type { ThreatEngineWorkerProcessedPayload } from '../workers/threat-engine-worker-types'
import type {
  SerializedAuraOverridesByActor,
  SerializedTalentRankOverridesByActor,
} from './threat-overrides'

function deserializeAuraOverridesByActor(
  serialized: SerializedAuraOverridesByActor | undefined,
): Map<number, ActorAuraOverrides> {
  return new Map(
    Object.entries(serialized ?? {}).flatMap(([rawActorId, overrides]) => {
      const actorId = Number.parseInt(rawActorId, 10)
      return Number.isInteger(actorId) && actorId > 0
        ? [[actorId, overrides] as const]
        : []
    }),
  )
}

function deserializeTalentRankOverridesByActor(
  serialized: SerializedTalentRankOverridesByActor | undefined,
): Map<number, ReadonlyMap<number, number>> {
  return new Map(
    Object.entries(serialized ?? {}).flatMap(([rawActorId, talentRanks]) => {
      const actorId = Number.parseInt(rawActorId, 10)
      if (!Number.isInteger(actorId) || actorId <= 0) {
        return []
      }

      const parsedTalentRanks = new Map(
        Object.entries(talentRanks).flatMap(([rawTalentEntryId, rank]) => {
          const talentEntryId = Number.parseInt(rawTalentEntryId, 10)
          return Number.isInteger(talentEntryId) && talentEntryId > 0
            ? [[talentEntryId, rank] as const]
            : []
        }),
      )
      return [[actorId, parsedTalentRanks] as const]
    }),
  )
}

/** Run the threat engine for a single fight and return the serialized processed payload. */
export function runThreatEngineForFight(params: {
  configId?: ThreatConfigId | null
  engine: ThreatEngine
  fightId: number
  inferThreatReduction: boolean
  initialAurasByActor: Record<string, number[]> | undefined
  auraOverridesByActor?: SerializedAuraOverridesByActor
  talentRankOverridesByActor?: SerializedTalentRankOverridesByActor
  rawEvents: WCLEvent[]
  report: Report
  startedAt: number
  tankActorIds: number[]
}): ThreatEngineWorkerProcessedPayload {
  const {
    configId = null,
    engine,
    fightId,
    inferThreatReduction,
    initialAurasByActor: serializedInitialAurasByActor,
    auraOverridesByActor: serializedAuraOverridesByActor,
    talentRankOverridesByActor: serializedTalentRankOverridesByActor,
    rawEvents,
    report,
    startedAt,
    tankActorIds,
  } = params

  const fight = report.fights.find(
    (candidateFight) => candidateFight.id === fightId,
  )
  if (!fight) {
    throw new Error(`fight ${fightId} not found in report payload`)
  }

  const config = configId
    ? getThreatConfigById(configId)
    : resolveConfigOrNull({ report })
  if (!config) {
    throw new Error(
      `no threat config for gameVersion ${report.masterData.gameVersion}`,
    )
  }

  const initialAurasByActor = deserializeInitialAurasByActor(
    serializedInitialAurasByActor,
  )
  const auraOverridesByActor = deserializeAuraOverridesByActor(
    serializedAuraOverridesByActor,
  )
  const talentRankOverridesByActor = deserializeTalentRankOverridesByActor(
    serializedTalentRankOverridesByActor,
  )
  const { actorMap, friendlyActorIds, enemies, abilitySchoolMap } =
    buildThreatEngineInput({
      fight,
      actors: report.masterData.actors,
      abilities: report.masterData.abilities,
    })
  const { augmentedEvents, initialAurasByActor: effectiveInitialAurasByActor } =
    engine.processEvents({
      rawEvents,
      initialAurasByActor,
      auraOverridesByActor,
      talentRankOverridesByActor,
      actorMap,
      friendlyActorIds,
      abilitySchoolMap,
      enemies,
      encounterId: fight.encounterID ?? null,
      report,
      fight,
      inferThreatReduction,
      tankActorIds: new Set(tankActorIds),
      config,
    })

  return {
    augmentedEvents,
    initialAurasByActor: serializeInitialAurasByActor(
      effectiveInitialAurasByActor,
    ),
    processDurationMs: Math.round(performance.now() - startedAt),
  }
}
