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

describe('FightQuickSwitcher', () => {
  it('keeps fresh query param when forceFresh is enabled', () => {
    render(
      <MemoryRouter>
        <FightQuickSwitcher
          fights={fights}
          forceFresh
          reportId="ABC123"
          selectedFightId={26}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Grobbulus' })).toHaveAttribute(
      'href',
      '/report/ABC123/fight/30?fresh=1',
    )
  })

  it('keeps fresh alongside pinned player params', () => {
    render(
      <MemoryRouter>
        <FightQuickSwitcher
          fights={fights}
          forceFresh
          pinnedPlayerIds={[2, 1, 2]}
          reportId="ABC123"
          selectedFightId={26}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Grobbulus' })).toHaveAttribute(
      'href',
      '/report/ABC123/fight/30?fresh=1&pinnedPlayers=1%2C2&players=1%2C2',
    )
  })
})
