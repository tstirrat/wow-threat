/**
 * Shared core threat-engine execution pipeline used by both the main-thread
 * fallback path and the dedicated Web Worker.
 */
import {
  type ThreatConfigId,
  getThreatConfigById,
  resolveConfigOrNull,
} from '@wow-threat/config'
import { type ThreatEngine, buildThreatEngineInput } from '@wow-threat/engine'
import {
  deserializeInitialAurasByActor,
  serializeInitialAurasByActor,
} from '@wow-threat/shared'
import type { Report, WCLEvent } from '@wow-threat/wcl-types'

import type { ThreatEngineWorkerProcessedPayload } from '../workers/threat-engine-worker-types'

/** Run the threat engine for a single fight and return the serialized processed payload. */
export function runThreatEngineForFight(params: {
  configId?: ThreatConfigId | null
  engine: ThreatEngine
  fightId: number
  inferThreatReduction: boolean
  initialAurasByActor: Record<string, number[]> | undefined
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
