/**
 * Component tests for recent report row metadata rendering.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { RecentReportEntry } from '../types/app'
import { RecentReportsList } from './recent-reports-list'

const baseEntry: RecentReportEntry = {
  reportId: 'f9yPamzBxQqhGndZ',
  title: 'Threat Regression Raid',
  sourceHost: 'fresh.warcraftlogs.com',
  lastOpenedAt: 1_707_000_000_000,
  zoneName: 'Naxxramas',
  startTime: 1_707_000_000_000,
  bossKillCount: 2,
  guildName: 'Threat Officer Guild',
}

describe('RecentReportsList', () => {
  it('renders title row metadata and alliance color class', () => {
    const onRemoveReport = vi.fn()

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <RecentReportsList
          onRemoveReport={onRemoveReport}
          reports={[
            {
              ...baseEntry,
              guildFaction: 'Alliance',
            },
          ]}
        />
      </MemoryRouter>,
    )

    const reportLink = screen.getByRole('link', {
      name: /Threat Regression Raid/,
    })

    expect(reportLink).toHaveTextContent(
      'Threat Regression Raid <Threat Officer Guild> (fresh)',
    )
    expect(reportLink).toHaveClass('text-sky-600')
    expect(screen.getByText(/Naxxramas - .* - 2 bosses/)).toBeVisible()
  })

  it('renders horde color class when faction is horde', () => {
    const onRemoveReport = vi.fn()

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <RecentReportsList
          onRemoveReport={onRemoveReport}
          reports={[
            {
              ...baseEntry,
              guildFaction: 'Horde',
            },
          ]}
        />
      </MemoryRouter>,
    )

    const reportLink = screen.getByRole('link', {
      name: /Threat Regression Raid/,
    })
    expect(reportLink).toHaveClass('text-red-600')
  })

  it('calls onRemoveReport when delete button is clicked', async () => {
    const onRemoveReport = vi.fn()
    const user = userEvent.setup()

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <RecentReportsList
          onRemoveReport={onRemoveReport}
          reports={[
            {
              ...baseEntry,
              guildFaction: 'Alliance',
            },
          ]}
        />
      </MemoryRouter>,
    )

    await user.click(
      screen.getByRole('button', {
        name: `Remove recent report ${baseEntry.title}`,
      }),
    )

    expect(onRemoveReport).toHaveBeenCalledWith(baseEntry.reportId)
  })

  it('calls onToggleStarReport when star button is clicked', async () => {
    const onRemoveReport = vi.fn()
    const onToggleStarReport = vi.fn()
    const user = userEvent.setup()

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <RecentReportsList
          onRemoveReport={onRemoveReport}
          onToggleStarReport={onToggleStarReport}
          reports={[
            {
              ...baseEntry,
              guildFaction: 'Alliance',
            },
          ]}
        />
      </MemoryRouter>,
    )

    await user.click(
      screen.getByRole('button', {
        name: `Star report ${baseEntry.title}`,
      }),
    )

    expect(onToggleStarReport).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: baseEntry.reportId,
        title: baseEntry.title,
        sourceHost: baseEntry.sourceHost,
      }),
    )
  })

  it('renders archived entries as disabled with an archived badge', () => {
    const onRemoveReport = vi.fn()

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <RecentReportsList
          onRemoveReport={onRemoveReport}
          reports={[
            {
              ...baseEntry,
              isArchived: true,
            },
          ]}
        />
      </MemoryRouter>,
    )

    expect(
      screen.queryByRole('link', { name: /Threat Regression Raid/ }),
    ).toBeNull()
    expect(screen.getByText('archived')).toBeVisible()
  })

  it('renders example logs inside the empty-state card', () => {
    const onRemoveReport = vi.fn()

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <RecentReportsList
          exampleReports={[
            {
              label: 'Fresh Example',
              reportId: 'f9yPamzBxQqhGndZ',
              host: 'fresh.warcraftlogs.com',
              href: '/report/f9yPamzBxQqhGndZ',
            },
          ]}
          onRemoveReport={onRemoveReport}
          reports={[]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('No recent reports yet (fresh)')).toBeVisible()
    expect(screen.getByText('Example logs')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Fresh Example', exact: true }),
    ).toBeVisible()
  })
})
