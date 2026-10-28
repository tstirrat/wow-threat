/**
 * Unit tests for AppRail collapse behaviour and slot rendering.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { useRailReportSection } from '../routes/app-shell-context'
import { AppShellProvider } from '../routes/app-shell-provider'
import { AppRail } from './app-rail'

const ReportSlotFiller = () => {
  useRailReportSection(<p>Report outline</p>)
  return null
}

describe('AppRail', () => {
  it('shows only the library outside report routes', () => {
    render(
      <AppShellProvider>
        <AppRail librarySection={<p>Library content</p>} />
      </AppShellProvider>,
    )

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByText('Library content')).toBeVisible()
  })

  it('shows This report and Library tabs on report routes, defaulting to This report', async () => {
    const user = userEvent.setup()
    render(
      <AppShellProvider>
        <AppRail librarySection={<p>Library content</p>} />
        <ReportSlotFiller />
      </AppShellProvider>,
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
      <AppShellProvider>
        <AppRail librarySection={<p>Library content</p>} />
      </AppShellProvider>,
    )

    expect(screen.getByTestId('app-rail')).toHaveAttribute('data-state', 'open')
    expect(screen.getByTestId('app-rail-library-section')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.getByTestId('app-rail')).toHaveAttribute(
      'data-state',
      'closed',
    )
    expect(
      screen.queryByTestId('app-rail-library-section'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(screen.getByTestId('app-rail')).toHaveAttribute('data-state', 'open')
  })

  it('renders content set through the report section slot', () => {
    render(
      <AppShellProvider>
        <AppRail />
        <ReportSlotFiller />
      </AppShellProvider>,
    )

    expect(screen.getByText('Report outline')).toBeInTheDocument()
  })
})
