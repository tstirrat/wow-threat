/**
 * Naxxramas Integration Tests
 *
 * Fixture-driven integration tests for anniversary Naxx encounter behavior.
 */
import { describe, expect, it } from 'vitest'

import {
  buildActorThreatTotals,
  buildThreatSnapshotLines,
  hasConfigFixture,
  loadConfigFixture,
  runConfigFixture,
} from '../../integration/helpers'
import { anniversaryConfig } from '../index'

const fixtureName = 'anniversary/naxx/patchwerk-fight-26'

describe('anniversary naxx integration', () => {
  if (!hasConfigFixture(fixtureName)) {
    it(`skips when fixture ${fixtureName} is missing`, (context) => {
      context.skip()
    })
    return
  }

  it('snapshots patchwerk threat event lines', async () => {
    const fixture = await loadConfigFixture(fixtureName)
    if (!fixture) {
      throw new Error(`Fixture ${fixtureName} could not be loaded`)
    }

    const { actorMap, augmentedEvents, abilityNameMap, fightStartTime } =
      runConfigFixture(fixture, {
        config: anniversaryConfig,
      })
    const snapshot = buildThreatSnapshotLines(augmentedEvents, actorMap, {
      focusActorId: fixture.metadata.focusActorId,
      focusTargetId: 203,
      focusTargetInstance: 0,
      abilityNameMap,
      fightStartTime,
      maxLines: fixture.metadata.maxSnapshotLines ?? 600,
    })

    expect(snapshot).toMatchSnapshot()
  })

  it('snapshots top 10 totals for patchwerk fixture', async () => {
    const fixture = await loadConfigFixture(fixtureName)
    if (!fixture) {
      throw new Error(`Fixture ${fixtureName} could not be loaded`)
    }

    const { actorMap, augmentedEvents } = runConfigFixture(fixture, {
      config: anniversaryConfig,
    })
    const topTen = buildActorThreatTotals(augmentedEvents, actorMap)
      .slice(0, 10)
      .map(
        ({ actorId, actorName, totalThreat }) =>
          `${actorName}#${actorId}=${totalThreat.toFixed(2)}`,
      )

    expect(topTen).toMatchSnapshot()
  })
})
