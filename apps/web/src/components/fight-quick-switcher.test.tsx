/**
 * Unit tests for fight quick-switch link query param behavior.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { ReportFightSummary } from '../types/api'
import { FightQuickSwitcher } from './fight-quick-switcher'

function createFight(
  overrides: Partial<ReportFightSummary>,
): ReportFightSummary {
  return {
    id: 1,
    encounterID: 111,
    name: 'Patchwerk',
    startTime: 0,
    endTime: 1000,
    kill: true,
    difficulty: null,
    bossPercentage: null,
    fightPercentage: null,
    enemyNPCs: [],
    enemyPets: [],
    friendlyPlayers: [1],
    friendlyPets: [],
    ...overrides,
  }
}

describe('FightQuickSwitcher', () => {
  it('preserves eventsMode on fight quick-switch links', () => {
    render(
      <MemoryRouter>
        <FightQuickSwitcher
          eventsMode="legacy"
          fights={[
            createFight({
              id: 26,
              name: 'Patchwerk',
            }),
            createFight({
              id: 30,
              name: 'Grobbulus',
            }),
          ]}
          reportId="ABC123xyz"
          selectedFightId={26}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Grobbulus' })).toHaveAttribute(
      'href',
      '/report/ABC123xyz/fight/30?eventsMode=legacy',
    )
  })

  it('keeps eventsMode while preserving pinned players on quick-switch links', () => {
    render(
      <MemoryRouter>
        <FightQuickSwitcher
          eventsMode="legacy"
          fights={[
            createFight({
              id: 26,
              name: 'Patchwerk',
            }),
            createFight({
              id: 30,
              name: 'Grobbulus',
            }),
          ]}
          pinnedPlayerIds={[3, 1, 3]}
          reportId="ABC123xyz"
          selectedFightId={26}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Grobbulus' })).toHaveAttribute(
      'href',
      '/report/ABC123xyz/fight/30?pinnedPlayers=1%2C3&players=1%2C3&eventsMode=legacy',
    )
  })
})
