/**
 * Unit tests for AppRail collapse behaviour and slot rendering.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useRailReportSection } from '../routes/app-shell-context'
import { AppShellProvider } from '../routes/app-shell-provider'
import { stubMatchMedia } from '../test/helpers/match-media'
import { AppRail } from './app-rail'

vi.mock('@/auth/auth-provider', () => ({
  useAuth: () => ({
    authEnabled: false,
    isBusy: false,
    isInitializing: false,
    signOut: vi.fn(),
    startWclLogin: vi.fn(),
    wclUserId: null,
    wclUserName: null,
  }),
}))
vi.mock('@/hooks/use-wcl-rate-limit', () => ({
  useWclRateLimit: () => ({
    rateLimit: null,
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

const ReportSlotFiller = () => {
  useRailReportSection(<p>Report outline</p>)
  return null
}

describe('AppRail', () => {
  it('shows only the library outside report routes', () => {
    render(
      <MemoryRouter>
        <AppShellProvider>
          <AppRail librarySection={<p>Library content</p>} />
        </AppShellProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByText('Library content')).toBeVisible()
  })

  it('shows This report and Library tabs on report routes, defaulting to This report', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AppShellProvider>
          <AppRail librarySection={<p>Library content</p>} />
          <ReportSlotFiller />
        </AppShellProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('tab', { name: 'This report' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('Report outline')).toBeVisible()
    expect(screen.queryByText('Library content')).not.toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Library' }))
    expect(screen.getByText('Library content')).toBeVisible()
    expect(screen.getByText('Report outline')).not.toBeVisible()
  })

  it('is open by default and toggles collapsed state', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AppShellProvider>
          <AppRail librarySection={<p>Library content</p>} />
        </AppShellProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('app-rail')).toHaveAttribute('data-state', 'open')
    expect(screen.getByTestId('app-rail-library-section')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.getByTestId('app-rail')).toHaveAttribute(
      'data-state',
      'closed',
    )
    expect(screen.getByTestId('rail-account')).toBeInTheDocument()
    expect(screen.queryByText('Auth disabled')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('app-rail-library-section'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(screen.getByTestId('app-rail')).toHaveAttribute('data-state', 'open')
  })

  it('renders content set through the report section slot', () => {
    render(
      <MemoryRouter>
        <AppShellProvider>
          <AppRail />
          <ReportSlotFiller />
        </AppShellProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Report outline')).toBeInTheDocument()
  })

  describe('below 760px', () => {
    let restoreMatchMedia: () => void

    beforeEach(() => {
      restoreMatchMedia = stubMatchMedia(true)
    })

    afterEach(() => {
      restoreMatchMedia()
    })

    it('stays off-canvas until opened', () => {
      render(
        <MemoryRouter>
          <AppShellProvider>
            <AppRail librarySection={<p>Library content</p>} />
          </AppShellProvider>
        </MemoryRouter>,
      )

      expect(screen.queryByTestId('app-rail')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Collapse sidebar' }),
      ).not.toBeInTheDocument()
    })

    it('opens as a sheet and closes with Escape and the close button', async () => {
      const user = userEvent.setup()
      const onMobileOpenChange = vi.fn()
      render(
        <MemoryRouter>
          <AppShellProvider>
            <AppRail
              isMobileOpen
              librarySection={<p>Library content</p>}
              onMobileOpenChange={onMobileOpenChange}
            />
            <ReportSlotFiller />
          </AppShellProvider>
        </MemoryRouter>,
      )

      expect(screen.getByRole('dialog', { name: 'Sidebar' })).toBeVisible()
      expect(screen.getByTestId('rail-account')).toBeVisible()
      expect(screen.getByText('Report outline')).toBeVisible()

      await user.keyboard('{Escape}')
      expect(onMobileOpenChange).toHaveBeenLastCalledWith(false)

      onMobileOpenChange.mockClear()
      await user.click(screen.getByRole('button', { name: 'Close sidebar' }))
      expect(onMobileOpenChange).toHaveBeenLastCalledWith(false)
    })
  })
})
