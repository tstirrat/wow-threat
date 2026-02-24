/**
 * Wiring tests for fight page settings-aware event query behavior.
 */
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FightPage } from './fight-page'

const useFightDataMock = vi.fn()
const useFightEventsMock = vi.fn()
const useFightQueryStateMock = vi.fn()
const useUserSettingsMock = vi.fn()
const useReportRouteContextMock = vi.fn()
const resolveCurrentThreatConfigMock = vi.fn()

vi.mock('../hooks/use-fight-data', () => ({
  useFightData: () => useFightDataMock(),
}))
vi.mock('../hooks/use-fight-events', () => ({
  useFightEvents: (...args: unknown[]) => useFightEventsMock(...args),
}))
vi.mock('../hooks/use-fight-query-state', () => ({
  useFightQueryState: () => useFightQueryStateMock(),
}))
vi.mock('../hooks/use-user-settings', () => ({
  useUserSettings: () => useUserSettingsMock(),
}))
vi.mock('../routes/report-layout-context', () => ({
  useReportRouteContext: () => useReportRouteContextMock(),
}))
vi.mock('../lib/threat-config', () => ({
  resolveCurrentThreatConfig: (...args: unknown[]) =>
    resolveCurrentThreatConfigMock(...args),
}))

describe('FightPage inferThreatReduction startup behavior', () => {
  beforeEach(() => {
    useFightDataMock.mockReset()
    useFightEventsMock.mockReset()
    useFightQueryStateMock.mockReset()
    useUserSettingsMock.mockReset()
    useReportRouteContextMock.mockReset()
    resolveCurrentThreatConfigMock.mockReset()

    useFightDataMock.mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
    })
    useFightEventsMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    })
    useFightQueryStateMock.mockReturnValue({
      setFocus: vi.fn(),
      setPlayers: vi.fn(),
      setTarget: vi.fn(),
      setWindow: vi.fn(),
      state: {
        endMs: null,
        focusId: null,
        players: [],
        startMs: null,
        targetId: null,
        targetInstance: null,
      },
    })
    useReportRouteContextMock.mockReturnValue({
      reportData: {},
      reportHost: 'fresh.warcraftlogs.com',
      reportId: 'WaxMPvZrAHT9gJhc',
    })
    resolveCurrentThreatConfigMock.mockReturnValue(null)
  })

  it('gates first events request until user settings finish loading', () => {
    let isSettingsLoading = true
    useUserSettingsMock.mockImplementation(() => ({
      error: null,
      isLoading: isSettingsLoading,
      isSaving: false,
      settings: {
        inferThreatReduction: true,
        showEnergizeEvents: false,
        showPets: false,
      },
      updateSettings: vi.fn(),
    }))

    const rendered = render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/report/WaxMPvZrAHT9gJhc/fight/9']}
      >
        <Routes>
          <Route
            path="/report/:reportId/fight/:fightId"
            element={<FightPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(useFightEventsMock).toHaveBeenNthCalledWith(
      1,
      'WaxMPvZrAHT9gJhc',
      9,
      null,
      true,
      false,
    )
    expect(
      useFightEventsMock.mock.calls.some((call) => call[3] === false),
    ).toBe(false)

    isSettingsLoading = false
    rendered.rerender(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/report/WaxMPvZrAHT9gJhc/fight/9']}
      >
        <Routes>
          <Route
            path="/report/:reportId/fight/:fightId"
            element={<FightPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(useFightEventsMock).toHaveBeenNthCalledWith(
      2,
      'WaxMPvZrAHT9gJhc',
      9,
      null,
      true,
      true,
    )
    expect(
      useFightEventsMock.mock.calls.some((call) => call[3] === false),
    ).toBe(false)
  })
})
