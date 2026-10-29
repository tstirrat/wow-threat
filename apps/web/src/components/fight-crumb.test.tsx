/**
 * Tests for the report and fight crumbs of the app bar title.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { ReportFightSummary } from '../types/api'
import { FightCrumb, ReportCrumb } from './fight-crumb'

const fight = (id: number, name: string): ReportFightSummary =>
  ({
    id,
    name,
    kill: true,
    encounterID: id,
    startTime: 0,
    endTime: 120000,
  }) as ReportFightSummary

const LocationProbe = () => {
  const location = useLocation()
  return (
    <p data-testid="location">{`${location.pathname}${location.search}`}</p>
  )
}

describe('FightCrumb', () => {
  it('navigates to another boss kill keeping query params', async () => {
    render(
      <MemoryRouter initialEntries={['/report/abc/fight/1']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <FightCrumb
                  eventsMode="live"
                  fightLabel="Patchwerk · Kill · 2:00"
                  fightShortLabel="Patchwerk"
                  fights={[fight(1, 'Patchwerk'), fight(2, 'Grobbulus')]}
                  pinnedPlayerIds={[3]}
                  reportId="abc"
                  selectedFightId={1}
                />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    await userEvent.click(
      screen.getByRole('button', { name: /Fight: Patchwerk/ }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Grobbulus' }))

    const location = screen.getByTestId('location').textContent ?? ''
    expect(location).toContain('/report/abc/fight/2')
    expect(location).toContain('eventsMode=live')
    expect(location).toContain('pinnedPlayers=3')
  })
})

describe('ReportCrumb', () => {
  it('links to the report page', () => {
    render(
      <MemoryRouter>
        <ReportCrumb reportId="abc" reportTitle="Naxx Night" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Naxx Night' })).toHaveAttribute(
      'href',
      '/report/abc',
    )
  })
})
