/**
 * Component tests for the rail report outline: metadata, pull list links and star toggle.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { ReportFightSummary, ReportResponse } from '../types/api'
import { ReportOutline, ReportOutlineSkeleton } from './report-outline'

const createFight = (
  overrides: Partial<ReportFightSummary> &
    Pick<ReportFightSummary, 'id' | 'name'>,
): ReportFightSummary => ({
  encounterID: 1000 + overrides.id,
  classicSeasonID: 3,
  startTime: 1000,
  endTime: 2000,
  kill: true,
  difficulty: 3,
  bossPercentage: null,
  fightPercentage: null,
  enemyNPCs: [],
  enemyPets: [],
  friendlyPlayers: [1, 2, 2, 999],
  friendlyPets: [],
  ...overrides,
})

function createReport(): ReportResponse {
  return {
    code: 'ABC123xyz',
    title: 'Threat Regression Raid',
    visibility: 'public',
    owner: 'test-owner',
    guild: {
      id: 777,
      name: 'Threat Guild',
      faction: 'Alliance',
      serverSlug: 'benediction',
      serverRegion: 'US',
    },
    archiveStatus: null,
    startTime: Date.UTC(2026, 1, 1, 0, 0, 0, 0),
    endTime: Date.UTC(2026, 1, 1, 1, 0, 0, 0),
    gameVersion: 2,
    threatConfig: null,
    zone: { id: 1001, name: 'Naxxramas', partitions: [] },
    fights: [
      createFight({ id: 26, name: 'Patchwerk' }),
      createFight({ id: 30, name: 'Grobbulus' }),
    ],
    actors: [
      { id: 1, name: 'Aegistank', type: 'Player', subType: 'Warrior' },
      { id: 2, name: 'Bladefury', type: 'Player', subType: 'Warrior' },
      { id: 3, name: 'Arrowyn', type: 'Player', subType: 'Hunter' },
      { id: 4, name: 'Flashheal', type: 'Player', subType: 'Priest' },
    ],
    abilities: [],
  }
}

function renderOutline(
  options: Partial<React.ComponentProps<typeof ReportOutline>> = {},
): void {
  const report = createReport()

  render(
    <MemoryRouter>
      <ReportOutline
        isStarred={false}
        onToggleStar={() => {}}
        report={report}
        reportHost="fresh.warcraftlogs.com"
        reportId={report.code}
        selectedFightId={26}
        threatConfigLabel="Era v1"
        {...options}
      />
    </MemoryRouter>,
  )
}

describe('ReportOutline', () => {
  it('shows fight player count when a fight is selected', () => {
    renderOutline()

    expect(screen.getByText('2 players')).toBeVisible()
    expect(screen.getByText('Threat config: Era v1')).toBeVisible()
  })

  it('shows report-level player count when no fight is selected', () => {
    renderOutline({ selectedFightId: null })

    expect(screen.getByText('4 players')).toBeVisible()
  })

  it('links guild name to guild reports page', () => {
    renderOutline()

    expect(
      screen.getByRole('link', { name: '<Threat Guild>' }),
    ).toHaveAttribute(
      'href',
      '/reports/guild/777?name=Threat+Guild&serverSlug=benediction&serverRegion=US',
    )
  })

  it('highlights only the current fight', () => {
    renderOutline()

    expect(screen.getByRole('link', { name: 'Patchwerk' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Grobbulus' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('carries fresh, pinned players, eventsMode and config on pull links', () => {
    renderOutline({
      configId: 'era',
      eventsMode: 'legacy',
      forceFresh: true,
      pinnedPlayerIds: [2, 1, 2],
    })

    expect(screen.getByRole('link', { name: 'Grobbulus' })).toHaveAttribute(
      'href',
      '/report/ABC123xyz/fight/30?fresh=1&pinnedPlayers=1%2C2&players=1%2C2&eventsMode=legacy&config=era',
    )
  })

  it('omits the query string when no params are carried', () => {
    renderOutline()

    expect(screen.getByRole('link', { name: 'Grobbulus' })).toHaveAttribute(
      'href',
      '/report/ABC123xyz/fight/30',
    )
  })

  it('toggles the star', () => {
    const onToggleStar = vi.fn()
    renderOutline({ onToggleStar })

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Star report Threat Regression Raid',
      }),
    )

    expect(onToggleStar).toHaveBeenCalledTimes(1)
  })

  it('disables the star while settings are saving', () => {
    renderOutline({ isStarToggleDisabled: true })

    expect(
      screen.getByRole('button', {
        name: 'Star report Threat Regression Raid',
      }),
    ).toBeDisabled()
  })

  it('renders a skeleton while loading', () => {
    render(<ReportOutlineSkeleton />)

    expect(screen.getByLabelText('Loading report header')).toBeVisible()
  })
})
