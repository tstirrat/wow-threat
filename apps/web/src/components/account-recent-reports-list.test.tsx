/**
 * Component tests for merged personal/guild account report rendering.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { RecentReportSummary } from '../types/api'
import { AccountRecentReportsList } from './account-recent-reports-list'

const reports: RecentReportSummary[] = [
  {
    code: 'PERSONAL123',
    title: 'Personal Log',
    startTime: 1_707_000_000_000,
    endTime: 1_707_003_600_000,
    zoneName: 'Naxxramas',
    guildName: 'Threat Guild',
    guildFaction: 'Alliance',
    source: 'personal',
  },
  {
    code: 'GUILD456',
    title: 'Guild Log',
    startTime: 1_707_100_000_000,
    endTime: 1_707_103_600_000,
    zoneName: 'Blackwing Lair',
    guildName: 'Threat Guild',
    guildFaction: 'Horde',
    source: 'guild',
  },
]

describe('AccountRecentReportsList', () => {
  it('renders merged personal and guild reports with source labels', () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AccountRecentReportsList reports={reports} />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('link', { name: /Personal Log/ }),
    ).toHaveTextContent('Personal Log <Threat Guild>')
    expect(screen.getByRole('link', { name: /Guild Log/ })).toHaveClass(
      'text-red-600',
    )
    expect(screen.getByText(/Naxxramas - .* - personal log/)).toBeVisible()
    expect(screen.getByText(/Blackwing Lair - .* - guild log/)).toBeVisible()
  })

  it('renders empty state when there are no account reports', () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AccountRecentReportsList reports={[]} />
      </MemoryRouter>,
    )

    expect(
      screen.getByText('No recent Warcraft Logs history yet'),
    ).toBeVisible()
  })
})
