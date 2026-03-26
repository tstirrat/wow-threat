/**
 * Component tests for fight quick-switch query-param behavior.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { ReportFightSummary } from '../types/api'
import { FightQuickSwitcher } from './fight-quick-switcher'

const fights: ReportFightSummary[] = [
  {
    id: 26,
    encounterID: 1001,
    classicSeasonID: 3,
    name: 'Patchwerk',
    startTime: 1000,
    endTime: 2000,
    kill: true,
    difficulty: 3,
    bossPercentage: null,
    fightPercentage: null,
    enemyNPCs: [],
    enemyPets: [],
    friendlyPlayers: [1, 2, 3],
    friendlyPets: [],
  },
  {
    id: 30,
    encounterID: 1002,
    classicSeasonID: 3,
    name: 'Grobbulus',
    startTime: 3000,
    endTime: 4000,
    kill: true,
    difficulty: 3,
    bossPercentage: null,
    fightPercentage: null,
    enemyNPCs: [],
    enemyPets: [],
    friendlyPlayers: [1, 2, 3],
    friendlyPets: [],
  },
]

function renderFightQuickSwitcher(options?: {
  eventsMode?: string | null
  forceFresh?: boolean
  pinnedPlayerIds?: number[]
}): void {
  const {
    eventsMode = null,
    forceFresh = false,
    pinnedPlayerIds = [],
  } = options ?? {}

  render(
    <MemoryRouter>
      <FightQuickSwitcher
        eventsMode={eventsMode}
        fights={fights}
        forceFresh={forceFresh}
        pinnedPlayerIds={pinnedPlayerIds}
        reportId="ABC123"
        selectedFightId={26}
      />
    </MemoryRouter>,
  )
}

describe('FightQuickSwitcher', () => {
  it('keeps fresh query param when forceFresh is enabled', () => {
    renderFightQuickSwitcher({
      forceFresh: true,
    })

    expect(screen.getByRole('link', { name: 'Grobbulus' })).toHaveAttribute(
      'href',
      '/report/ABC123/fight/30?fresh=1',
    )
  })

  it('preserves eventsMode on fight quick-switch links', () => {
    renderFightQuickSwitcher({
      eventsMode: 'legacy',
    })

    expect(screen.getByRole('link', { name: 'Grobbulus' })).toHaveAttribute(
      'href',
      '/report/ABC123/fight/30?eventsMode=legacy',
    )
  })

  it('keeps fresh alongside pinned player params', () => {
    renderFightQuickSwitcher({
      forceFresh: true,
      pinnedPlayerIds: [2, 1, 2],
    })

    expect(screen.getByRole('link', { name: 'Grobbulus' })).toHaveAttribute(
      'href',
      '/report/ABC123/fight/30?fresh=1&pinnedPlayers=1%2C2&players=1%2C2',
    )
  })

  it('keeps eventsMode while preserving pinned players on quick-switch links', () => {
    renderFightQuickSwitcher({
      eventsMode: 'legacy',
      pinnedPlayerIds: [2, 1, 2],
    })

    expect(screen.getByRole('link', { name: 'Grobbulus' })).toHaveAttribute(
      'href',
      '/report/ABC123/fight/30?pinnedPlayers=1%2C2&players=1%2C2&eventsMode=legacy',
    )
  })

  it('keeps fresh and eventsMode while preserving pinned players', () => {
    renderFightQuickSwitcher({
      eventsMode: 'legacy',
      forceFresh: true,
      pinnedPlayerIds: [2, 1, 2],
    })

    expect(screen.getByRole('link', { name: 'Grobbulus' })).toHaveAttribute(
      'href',
      '/report/ABC123/fight/30?fresh=1&pinnedPlayers=1%2C2&players=1%2C2&eventsMode=legacy',
    )
  })
})
