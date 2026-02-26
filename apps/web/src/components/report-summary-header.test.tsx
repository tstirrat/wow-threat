/**
 * Component tests for report summary header metadata.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { ReportResponse } from '../types/api'
import { ReportSummaryHeader } from './report-summary-header'

function createReportResponse(
  overrides: Partial<ReportResponse> = {},
): ReportResponse {
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
    zone: {
      id: 1001,
      name: 'Naxxramas',
      partitions: [{ id: 3, name: 'Discovery' }],
    },
    fights: [
      {
        id: 26,
        encounterID: 1602,
        classicSeasonID: 3,
        name: 'Patchwerk',
        startTime: Date.UTC(2026, 1, 1, 0, 0, 0, 0),
        endTime: Date.UTC(2026, 1, 1, 0, 5, 0, 0),
        kill: true,
        difficulty: 3,
        bossPercentage: null,
        fightPercentage: null,
        enemyNPCs: [],
        enemyPets: [],
        friendlyPlayers: [1, 2, 2, 999],
        friendlyPets: [],
      },
    ],
    actors: [
      {
        id: 1,
        name: 'Aegistank',
        type: 'Player',
        subType: 'Warrior',
      },
      {
        id: 2,
        name: 'Bladefury',
        type: 'Player',
        subType: 'Warrior',
      },
      {
        id: 3,
        name: 'Arrowyn',
        type: 'Player',
        subType: 'Hunter',
      },
      {
        id: 4,
        name: 'Flashheal',
        type: 'Player',
        subType: 'Priest',
      },
      {
        id: 100,
        name: 'Patchwerk',
        type: 'NPC',
        subType: 'Boss',
      },
    ],
    abilities: [],
    ...overrides,
  }
}

describe('ReportSummaryHeader', () => {
  it('shows report-level player count when no fight is selected', () => {
    const report = createReportResponse()

    render(
      <MemoryRouter>
        <ReportSummaryHeader
          isStarred={false}
          onToggleStar={() => {}}
          report={report}
          reportHost="fresh.warcraftlogs.com"
          reportId={report.code}
          threatConfigLabel="No supported config"
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('4 players')).toBeVisible()
  })

  it('shows selected-fight player count from active participants', () => {
    const report = createReportResponse()

    render(
      <MemoryRouter>
        <ReportSummaryHeader
          isStarred={false}
          onToggleStar={() => {}}
          report={report}
          reportHost="fresh.warcraftlogs.com"
          reportId={report.code}
          selectedFightId={26}
          threatConfigLabel="No supported config"
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('2 players')).toBeVisible()
    expect(screen.queryByText('4 players')).toBeNull()
  })

  it('falls back to report-level players when selected fight does not exist', () => {
    const report = createReportResponse()

    render(
      <MemoryRouter>
        <ReportSummaryHeader
          isStarred={false}
          onToggleStar={() => {}}
          report={report}
          reportHost="fresh.warcraftlogs.com"
          reportId={report.code}
          selectedFightId={999}
          threatConfigLabel="No supported config"
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('4 players')).toBeVisible()
  })

  it('links guild name to guild reports page', () => {
    const report = createReportResponse()

    render(
      <MemoryRouter>
        <ReportSummaryHeader
          isStarred={false}
          onToggleStar={() => {}}
          report={report}
          reportHost="fresh.warcraftlogs.com"
          reportId={report.code}
          threatConfigLabel="No supported config"
        />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('link', { name: '<Threat Guild>' }),
    ).toHaveAttribute(
      'href',
      '/reports/guild/777?name=Threat+Guild&serverSlug=benediction&serverRegion=US',
    )
  })
})
