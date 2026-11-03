/**
 * Unit tests for the app bar's open-report dialog.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppBar } from './app-bar'

vi.mock('posthog-js/react', () => ({
  usePostHog: () => null,
}))

const reportUrl = 'https://fresh.warcraftlogs.com/reports/aB3dK9xQ2mN7pL4r'

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="pathname">{location.pathname}</p>
}

function renderBar(): void {
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={['/report/abc123']}
    >
      <AppBar />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const openButton = () => screen.getByRole('button', { name: 'Open report' })
const input = () => screen.getByLabelText('Warcraft Logs report URL or code')

describe('AppBar open report dialog', () => {
  beforeEach(() => {})

  it('opens from the button with an empty, focused input', async () => {
    renderBar()

    await userEvent.click(openButton())

    expect(screen.getByRole('dialog', { name: 'Open a report' })).toBeTruthy()
    expect(input()).toHaveFocus()
    expect(input()).toHaveValue('')
    expect(input()).toHaveAttribute('autocomplete', 'off')
  })

  it('opens with cmd+o', async () => {
    renderBar()

    await userEvent.keyboard('{Control>}o{/Control}')

    expect(
      await screen.findByRole('dialog', { name: 'Open a report' }),
    ).toBeTruthy()
  })

  it('shows an inline error for invalid input and stays open', async () => {
    renderBar()
    await userEvent.click(openButton())

    await userEvent.type(input(), 'not a report!!{Enter}')

    const error = await screen.findByText(/doesn't look like a Warcraft Logs/)
    expect(input()).toHaveAttribute('aria-describedby', error.id)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByTestId('pathname')).toHaveTextContent('/report/abc123')
  })

  it('navigates to the report and closes on a successful submit', async () => {
    renderBar()
    await userEvent.click(openButton())

    await userEvent.type(input(), `${reportUrl}{Enter}`)

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(
        '/report/aB3dK9xQ2mN7pL4r',
      ),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens retail www links without fetching the report first', async () => {
    renderBar()
    await userEvent.click(openButton())

    await userEvent.type(
      input(),
      'https://www.warcraftlogs.com/reports/yWKFrfb3npagBvV8?fight=2&type=threat{Enter}',
    )

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(
        '/report/yWKFrfb3npagBvV8',
      ),
    )
  })

  it('closes with Cancel and returns focus to the button', async () => {
    renderBar()
    await userEvent.click(openButton())

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(openButton()).toHaveFocus()
  })

  it('closes with Escape and returns focus to the button', async () => {
    renderBar()
    await userEvent.keyboard('{Control>}o{/Control}')
    await screen.findByRole('dialog')

    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(openButton()).toHaveFocus())
  })

  it('clears the input each time it opens', async () => {
    renderBar()
    await userEvent.click(openButton())
    await userEvent.type(input(), 'abc')
    await userEvent.keyboard('{Escape}')

    await userEvent.click(openButton())

    expect(input()).toHaveValue('')
  })
})
