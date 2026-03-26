/**
 * Unit tests for guild entity reports page header links.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EntityReportsResponse } from '../types/api'
import { EntityReportsPage } from './entity-reports-page'

const useEntityReportsMock = vi.fn()
const useUserSettingsMock = vi.fn()

vi.mock('../hooks/use-entity-reports', () => ({
  useEntityReports: () => useEntityReportsMock(),
}))

vi.mock('../hooks/use-user-settings', () => ({
  useUserSettings: () => useUserSettingsMock(),
}))

function createEntityReportsResponse(
  overrides: Partial<EntityReportsResponse> = {},
): EntityReportsResponse {
  return {
    entityType: 'guild',
    entity: {
      id: 777,
      name: 'Threat Guild',
      faction: 'Alliance',
      serverSlug: 'benediction',
      serverRegion: 'US',
    },
    reports: [
      {
        code: 'ABC123',
        title: 'Threat Regression Raid',
        startTime: 100,
        endTime: 200,
        zoneName: 'Naxxramas',
        guildName: 'Threat Guild',
        guildFaction: 'Alliance',
      },
    ],
    ...overrides,
  }
}

describe('EntityReportsPage', () => {
  beforeEach(() => {
    useEntityReportsMock.mockReset()
    useUserSettingsMock.mockReset()

    useEntityReportsMock.mockReturnValue({
      error: null,
      isLoading: false,
      isRefreshing: false,
      refresh: vi.fn(),
      response: createEntityReportsResponse(),
    })
    useUserSettingsMock.mockReturnValue({
      settings: {
        starredEntities: [],
      },
      isLoading: false,
      isSaving: false,
      isEntityStarred: vi.fn(() => false),
      toggleStarredEntity: vi.fn(),
    })
  })

  it('shows guild WCL link in header using active host and guild id context', () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={[
          {
            pathname: '/reports/guild/777',
            search:
              '?name=Threat%20Guild&serverSlug=benediction&serverRegion=US',
            state: {
              host: 'sod.warcraftlogs.com',
            },
          },
        ]}
      >
        <Routes>
          <Route
            path="/reports/:entityType/:entityId"
            element={<EntityReportsPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    const warcraftLogsLink = screen.getByRole('link', {
      name: 'View on Warcraft Logs',
    })
    expect(
      screen.getByRole('button', { name: 'Star guild Threat Guild' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible()
    expect(warcraftLogsLink).toHaveTextContent('WCL')
    expect(warcraftLogsLink).toHaveAttribute(
      'href',
      'https://sod.warcraftlogs.com/guild/id/777',
    )
  })

  it('applies faction color styling to the guild name in the header title', () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/reports/guild/777']}
      >
        <Routes>
          <Route
            path="/reports/:entityType/:entityId"
            element={<EntityReportsPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('<Threat Guild>')).toHaveClass('text-sky-600')
  })

  it('builds guild WCL link from lookup identity when route id is non-numeric', () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={[
          {
            pathname: '/reports/guild/lookup',
            search:
              '?name=Threat%20Guild&serverSlug=Wild-Growth&serverRegion=US',
          },
        ]}
      >
        <Routes>
          <Route
            path="/reports/:entityType/:entityId"
            element={<EntityReportsPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('link', { name: 'View on Warcraft Logs' }),
    ).toHaveAttribute(
      'href',
      'https://fresh.warcraftlogs.com/guild/us/wild-growth/Threat%20Guild',
    )
  })

  it('does not show guild WCL link for non-guild entity routes', () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/reports/character/42']}
      >
        <Routes>
          <Route
            path="/reports/:entityType/:entityId"
            element={<EntityReportsPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      screen.queryByRole('link', { name: 'View on Warcraft Logs' }),
    ).toBeNull()
    expect(screen.getByText('Unsupported entity type')).toBeVisible()
  })
})
