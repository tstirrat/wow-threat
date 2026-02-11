/**
 * Zul'Gurub Encounter Hooks
 *
 * Encounter-level preprocessors for Anniversary Edition.
 */
import type {
  EncounterId,
  EncounterPreprocessorFactory,
  EncounterThreatConfig,
} from '@wcl-threat/shared'

export const ZgEncounterIds = {
  HighPriestessArlokk: 791 as EncounterId,
} as const

const ARLOKK_DISAPPEAR_GAP_MS = 30000
const ARLOKK_NAME_TOKEN = 'arlokk'

/**
 * Track hostile cast gaps and apply a threat wipe on the first cast after reappearance.
 */
const createArlokkPreprocessor: EncounterPreprocessorFactory = (ctx) => {
  const lastCastTimestampBySource = new Map<number, number>()
  const arlokkSourceIds = new Set<number>(
    ctx.enemies
      .filter((enemy) => enemy.name.toLowerCase().includes(ARLOKK_NAME_TOKEN))
      .map((enemy) => enemy.id),
  )

  return (preprocessCtx) => {
    const event = preprocessCtx.event

    if (
      event.type !== 'cast' ||
      event.sourceIsFriendly ||
      !arlokkSourceIds.has(event.sourceID)
    ) {
      return undefined
    }

    const previousCastTimestamp = lastCastTimestampBySource.get(event.sourceID)
    lastCastTimestampBySource.set(event.sourceID, event.timestamp)

    if (
      previousCastTimestamp === undefined ||
      event.timestamp - previousCastTimestamp <= ARLOKK_DISAPPEAR_GAP_MS
    ) {
      return undefined
    }

    return {
      effects: [{ type: 'modifyThreat', multiplier: 0, target: 'all' }],
    }
  }
}

export const zgEncounters: Record<EncounterId, EncounterThreatConfig> = {
  [ZgEncounterIds.HighPriestessArlokk]: {
    preprocessor: createArlokkPreprocessor,
  },
}
