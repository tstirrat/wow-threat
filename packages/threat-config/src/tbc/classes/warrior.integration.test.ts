/**
 * Warrior Integration Tests
 *
 * Fixture-driven tests focused on warrior threat output within anniversary logs.
 */
import { describe, expect, it } from 'vitest'

import {
  buildActorThreatTotals,
  buildThreatSnapshotLines,
  hasConfigFixture,
  loadConfigFixture,
  runConfigFixture,
} from '../../test/integration/helpers'
import { anniversaryConfig } from '../index'

const fixtureName = 'anniversary/naxx/patchwerk-fight-26'

describe('anniversary warrior integration', () => {
  if (!hasConfigFixture(fixtureName)) {
    it(`skips when fixture ${fixtureName} is missing`, (context) => {
      context.skip()
    })
    return
  }

  it('snapshots warrior threat event lines', async () => {
    const fixture = await loadConfigFixture(fixtureName)
    if (!fixture) {
      throw new Error(`Fixture ${fixtureName} could not be loaded`)
    }

    const { actorMap, augmentedEvents, abilityNameMap, fightStartTime } =
      runConfigFixture(fixture, {
        config: anniversaryConfig,
      })
    const warriorIds = new Set(
      [...actorMap.entries()]
        .filter(([, actor]) => actor.class === 'warrior')
        .map(([actorId]) => actorId),
    )
    const trackedWarriorIds =
      fixture.metadata.focusActorId &&
      warriorIds.has(fixture.metadata.focusActorId)
        ? new Set([fixture.metadata.focusActorId])
        : warriorIds

    const snapshot = buildThreatSnapshotLines(augmentedEvents, actorMap, {
      focusActorId: fixture.metadata.focusActorId,
      focusTargetId: 203,
      focusTargetInstance: 0,
      abilityNameMap,
      fightStartTime,
      maxLines: fixture.metadata.maxSnapshotLines ?? 600,
      includeEvent: (event) => {
        if (!event.threat) {
          return false
        }

        const hasThreat =
          (event.threat.changes?.length ?? 0) > 0 ||
          event.threat.calculation.modifiedThreat !== 0
        if (!hasThreat) {
          return false
        }

        if (trackedWarriorIds.has(event.sourceID)) {
          return true
        }

        return (event.threat.changes ?? []).some((change) =>
          trackedWarriorIds.has(change.sourceId),
        )
      },
    })

    expect(snapshot).toMatchSnapshot()
  })

  it('snapshots top warrior totals', async () => {
    const fixture = await loadConfigFixture(fixtureName)
    if (!fixture) {
      throw new Error(`Fixture ${fixtureName} could not be loaded`)
    }

    const { actorMap, augmentedEvents } = runConfigFixture(fixture, {
      config: anniversaryConfig,
    })
    const warriors = buildActorThreatTotals(augmentedEvents, actorMap)
      .filter(({ actorId }) => actorMap.get(actorId)?.class === 'warrior')
      .map(
        ({ actorId, actorName, totalThreat }) =>
          `${actorName}#${actorId}=${totalThreat.toFixed(2)}`,
      )

    expect(warriors).toMatchSnapshot()
  })
})
