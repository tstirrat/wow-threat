/**
 * Unit tests for the app shell slot context.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useAppShell, useBarTitle } from './app-shell-context'
import { AppShellProvider } from './app-shell-provider'

const TitleReader = () => (
  <div data-testid="title">{useAppShell().barTitle}</div>
)
const TitleFiller = () => {
  useBarTitle('Fight 1')
  return null
}

describe('app shell context', () => {
  it('exposes the bar title while the filler is mounted and clears it after', () => {
    const { rerender } = render(
      <AppShellProvider>
        <TitleReader />
        <TitleFiller />
      </AppShellProvider>,
    )
    expect(screen.getByTestId('title')).toHaveTextContent('Fight 1')

    rerender(
      <AppShellProvider>
        <TitleReader />
      </AppShellProvider>,
    )
    expect(screen.getByTestId('title')).toBeEmptyDOMElement()
  })
})
