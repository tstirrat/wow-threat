/**
 * Zul'Gurub Integration Tests
 *
 * Fixture-driven validation for Arlokk disappearance threat wipes.
 */
import type { ThreatEffect } from '@wow-threat/shared'
import type { WCLEvent } from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import {
  type ConfigFixture,
  loadConfigFixture,
  runConfigFixture,
} from '../../test/integration/helpers'
import { eraConfig } from '../index'
import { Boss } from './zg'

const fixtureName = 'fresh/zg'
const ARLOKK_DISAPPEAR_GAP_MS = 30_000

function isThreatWipeEffect(effect: ThreatEffect): boolean {
  return (
    effect.type === 'modifyThreat' &&
    effect.target === 'all' &&
    effect.multiplier === 0
  )
}

function findArlokkActorId(fixture: ConfigFixture): number {
  const fight = fixture.report.fights.find(
    (candidate) => candidate.id === fixture.metadata.fightId,
  )
  if (!fight) {
    throw new Error(
      `Fixture ${fixtureName} is missing fight ${fixture.metadata.fightId}`,
    )
  }

  const arlokkEnemy = (fight.enemyNPCs ?? []).find(
    (enemy) => enemy.gameID === Boss.HighPriestessArlokk,
  )
  if (!arlokkEnemy) {
    throw new Error(`Fixture ${fixtureName} is missing Arlokk enemy actor`)
  }

  return arlokkEnemy.id
}

function findFirstArlokkEventAfterGap(
  events: WCLEvent[],
  arlokkActorId: number,
): { event: WCLEvent; index: number } | null {
  let previousTimestamp: number | null = null

  for (const [index, event] of events.entries()) {
    if (event.sourceID !== arlokkActorId) {
      continue
    }

    if (
      previousTimestamp !== null &&
      event.timestamp - previousTimestamp > ARLOKK_DISAPPEAR_GAP_MS
    ) {
      return { event, index }
    }

    previousTimestamp = event.timestamp
  }

  return null
}

describe('era zg integration', () => {
  it('applies and returns Arlokk wipe effect after disappearance gap', async () => {
    const fixture = await loadConfigFixture(fixtureName)
    if (!fixture) {
      throw new Error(`Fixture ${fixtureName} could not be loaded`)
    }

    const arlokkActorId = findArlokkActorId(fixture)
    const returnEvent = findFirstArlokkEventAfterGap(
      fixture.events,
      arlokkActorId,
    )
    expect(returnEvent).toBeTruthy()
    if (!returnEvent) {
      return
    }

    const { augmentedEvents } = runConfigFixture(fixture, {
      config: eraConfig,
    })
    const augmentedReturnEvent = augmentedEvents[returnEvent.index]
    expect(augmentedReturnEvent).toBeDefined()
    expect(augmentedReturnEvent?.sourceID).toBe(arlokkActorId)
    expect(augmentedReturnEvent?.type).toBe(returnEvent.event.type)

    const returnEffects =
      augmentedReturnEvent?.threat?.calculation.effects ?? []
    expect(returnEffects.some(isThreatWipeEffect)).toBe(true)

    const wipeChanges = augmentedReturnEvent?.threat?.changes ?? []
    expect(wipeChanges.length).toBeGreaterThan(0)
    expect(
      wipeChanges.every(
        (change) =>
          change.operator === 'set' &&
          change.targetId === arlokkActorId &&
          change.targetInstance === (returnEvent.event.sourceInstance ?? 0) &&
          change.amount === 0 &&
          change.total === 0,
      ),
    ).toBe(true)

    const wipeEvents = augmentedEvents.filter((event) => {
      const effects = event.threat?.calculation.effects ?? []
      return (
        event.sourceID === arlokkActorId && effects.some(isThreatWipeEffect)
      )
    })
    expect(wipeEvents).toHaveLength(1)
  })
})
