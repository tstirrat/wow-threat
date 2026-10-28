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
  it('is open by default and toggles collapsed state', async () => {
    const user = userEvent.setup()
    render(
      <AppShellProvider>
        <AppRail />
      </AppShellProvider>,
    )

    expect(screen.getByTestId('app-rail')).toHaveAttribute('data-state', 'open')
    expect(screen.getByTestId('app-rail-report-section')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.getByTestId('app-rail')).toHaveAttribute(
      'data-state',
      'closed',
    )
    expect(
      screen.queryByTestId('app-rail-report-section'),
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
