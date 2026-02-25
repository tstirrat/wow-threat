/**
 * Integration test for initial buff inference using real log fixtures.
 */
import type {
  ReportAbility,
  ReportActor,
  ReportFight,
  WCLEvent,
} from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import { createMockThreatConfig } from '../test/helpers/config'
import { readFixtureFile } from '../test/helpers/fixtures'
import { processEvents } from '../threat-engine'
import { buildThreatEngineInput } from '../wcl-input'

const Spells = {
  SoulstoneResurrection: 20764,
} as const

const FOCUS_ACTOR_ID = 25
const BUFF_BANDS_SEED_AURA_ID = 25315
const COMBATANTINFO_AURA_ID = 15366
const INFERRED_AURA_ID = Spells.SoulstoneResurrection

interface FightReportFixture {
  fight: ReportFight
  masterData: {
    actors: ReportActor[]
    abilities: ReportAbility[]
  }
}

interface InitialBuffBandsFixture {
  initialAurasByActor: Record<string, number[]>
}

function createInitialAurasByActorMap(
  fixture: InitialBuffBandsFixture,
): Map<number, readonly number[]> {
  return new Map(
    Object.entries(fixture.initialAurasByActor).map(([actorId, auraIds]) => [
      Number(actorId),
      [...auraIds],
    ]),
  )
}

function resolveCombatantInfoAuraIdsForActor(
  events: WCLEvent[],
  actorId: number,
): Set<number> {
  return events.reduce((auraIds, event) => {
    if (event.type !== 'combatantinfo' || event.sourceID !== actorId) {
      return auraIds
    }

    const eventAuraIds = (event.auras ?? [])
      .map((aura) => aura.ability)
      .filter((auraId): auraId is number => auraId !== undefined)
    eventAuraIds.forEach((auraId) => auraIds.add(auraId))
    return auraIds
  }, new Set<number>())
}

function resolveFirstBuffEventForActorAura(
  events: WCLEvent[],
  actorId: number,
  auraId: number,
): WCLEvent | undefined {
  return events.find(
    (event) =>
      (event.type === 'applybuff' ||
        event.type === 'refreshbuff' ||
        event.type === 'removebuff') &&
      event.targetID === actorId &&
      event.abilityGameID === auraId,
  )
}

const reportFixture = readFixtureFile<FightReportFixture>(
  'vanilla/naxx/report-fight-1.json',
)
const eventsFixture = readFixtureFile<WCLEvent[]>(
  'vanilla/naxx/fight-1-anub-rekhan-events.json',
)
const buffBandsFixture = readFixtureFile<InitialBuffBandsFixture>(
  'vanilla/naxx/fight-1-anub-rekhan-initial-buff-bands.json',
)

describe('infer-initial-buffs integration', () => {
  it('infers buffs not provided in the initial buff bands', () => {
    const initialAurasByActor = createInitialAurasByActorMap(buffBandsFixture)
    const buffBandAuraIds = new Set(
      initialAurasByActor.get(FOCUS_ACTOR_ID) ?? [],
    )

    expect(buffBandAuraIds.has(BUFF_BANDS_SEED_AURA_ID)).toBe(true)
    expect(buffBandAuraIds.has(COMBATANTINFO_AURA_ID)).toBe(false)
    expect(buffBandAuraIds.has(INFERRED_AURA_ID)).toBe(false)

    const combatantInfoAuraIds = resolveCombatantInfoAuraIdsForActor(
      eventsFixture,
      FOCUS_ACTOR_ID,
    )
    expect(combatantInfoAuraIds.has(COMBATANTINFO_AURA_ID)).toBe(true)
    expect(combatantInfoAuraIds.has(INFERRED_AURA_ID)).toBe(false)

    const firstObservedInferredAuraEvent = resolveFirstBuffEventForActorAura(
      eventsFixture,
      FOCUS_ACTOR_ID,
      INFERRED_AURA_ID,
    )
    expect(firstObservedInferredAuraEvent?.type).toBe('removebuff')
    const hasApplyBeforeInference = eventsFixture.some(
      (event) =>
        event.type === 'applybuff' &&
        event.targetID === FOCUS_ACTOR_ID &&
        event.abilityGameID === INFERRED_AURA_ID,
    )
    expect(hasApplyBeforeInference).toBe(false)

    const { actorMap, friendlyActorIds, enemies, abilitySchoolMap } =
      buildThreatEngineInput({
        fight: reportFixture.fight,
        actors: reportFixture.masterData.actors,
        abilities: reportFixture.masterData.abilities,
        rawEvents: eventsFixture,
      })

    const result = processEvents({
      rawEvents: eventsFixture,
      initialAurasByActor,
      actorMap,
      friendlyActorIds,
      abilitySchoolMap,
      enemies,
      encounterId: reportFixture.fight.encounterID ?? null,
      fight: reportFixture.fight,
      config: createMockThreatConfig(),
    })
    const canonicalInitialAuras = result.initialAurasByActor.get(FOCUS_ACTOR_ID)

    expect(canonicalInitialAuras).toBeDefined()
    expect(canonicalInitialAuras).toEqual(
      expect.arrayContaining([
        BUFF_BANDS_SEED_AURA_ID,
        COMBATANTINFO_AURA_ID,
        INFERRED_AURA_ID,
      ]),
    )
  })
})
