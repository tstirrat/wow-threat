/**
 * Zul'Gurub Encounter Hooks Tests
 */
import { createCastEvent, createMockActorContext } from '@wcl-threat/shared'
import type { Enemy, ThreatContext } from '@wcl-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { ZgEncounterIds, zgEncounters } from './zg'

function createPreprocessorContext(
  event: ThreatContext['event'],
): ThreatContext {
  return {
    event,
    amount: 0,
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: event.sourceID, name: 'Source', class: null },
    targetActor: { id: event.targetID, name: 'Target', class: null },
    encounterId: ZgEncounterIds.HighPriestessArlokk,
    actors: createMockActorContext(),
  }
}

describe('zg encounter hooks', () => {
  it('attaches threat wipe special when hostile cast gap exceeds 30 seconds', () => {
    const preprocessorFactory =
      zgEncounters[ZgEncounterIds.HighPriestessArlokk]?.preprocessor
    expect(preprocessorFactory).toBeDefined()

    const enemies: Enemy[] = [{ id: 99, name: 'Arlokk', instance: 0 }]
    const preprocessor = preprocessorFactory?.({
      encounterId: ZgEncounterIds.HighPriestessArlokk,
      enemies,
    })
    expect(preprocessor).toBeDefined()

    const firstCast = preprocessor?.(
      createPreprocessorContext(
        createCastEvent({
          timestamp: 1000,
          sourceID: 99,
          sourceIsFriendly: false,
          sourceInstance: 0,
          targetID: 1,
          targetIsFriendly: true,
          abilityGameID: 24189,
        }),
      ),
    )
    expect(firstCast).toBeUndefined()

    const shortGapCast = preprocessor?.(
      createPreprocessorContext(
        createCastEvent({
          timestamp: 25000,
          sourceID: 99,
          sourceIsFriendly: false,
          sourceInstance: 0,
          targetID: 1,
          targetIsFriendly: true,
          abilityGameID: 24190,
        }),
      ),
    )
    expect(shortGapCast).toBeUndefined()

    const longGapCast = preprocessor?.(
      createPreprocessorContext(
        createCastEvent({
          timestamp: 56050,
          sourceID: 99,
          sourceIsFriendly: false,
          sourceInstance: 0,
          targetID: 1,
          targetIsFriendly: true,
          abilityGameID: 24191,
        }),
      ),
    )

    expect(longGapCast?.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0,
      target: 'all',
    })
  })

  it('ignores non-Arlokk casts when tracking disappearance gaps', () => {
    const preprocessorFactory =
      zgEncounters[ZgEncounterIds.HighPriestessArlokk]?.preprocessor
    expect(preprocessorFactory).toBeDefined()

    const enemies: Enemy[] = [
      { id: 99, name: 'High Priestess Arlokk', instance: 0 },
      { id: 120, name: 'Zulian Prowler', instance: 0 },
    ]
    const preprocessor = preprocessorFactory?.({
      encounterId: ZgEncounterIds.HighPriestessArlokk,
      enemies,
    })
    expect(preprocessor).toBeDefined()

    const tigerCast = preprocessor?.(
      createPreprocessorContext(
        createCastEvent({
          timestamp: 1000,
          sourceID: 120,
          sourceIsFriendly: false,
          sourceInstance: 0,
          targetID: 1,
          targetIsFriendly: true,
          abilityGameID: 1,
        }),
      ),
    )
    expect(tigerCast).toBeUndefined()

    const firstArlokkCast = preprocessor?.(
      createPreprocessorContext(
        createCastEvent({
          timestamp: 35050,
          sourceID: 99,
          sourceIsFriendly: false,
          sourceInstance: 0,
          targetID: 1,
          targetIsFriendly: true,
          abilityGameID: 2,
        }),
      ),
    )
    expect(firstArlokkCast).toBeUndefined()

    const postGapArlokkCast = preprocessor?.(
      createPreprocessorContext(
        createCastEvent({
          timestamp: 66060,
          sourceID: 99,
          sourceIsFriendly: false,
          sourceInstance: 0,
          targetID: 1,
          targetIsFriendly: true,
          abilityGameID: 3,
        }),
      ),
    )

    expect(postGapArlokkCast?.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0,
      target: 'all',
    })
  })
})
