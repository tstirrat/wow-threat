/**
 * Tests for the ErrorBoundary component.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from './error-boundary'

const ThrowingChild = ({ message }: { message: string }) => {
  throw new Error(message)
}

const SafeChild = () => <p>safe content</p>

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <SafeChild />
      </ErrorBoundary>,
    )

    expect(screen.getByText('safe content')).toBeInTheDocument()
  })

  it('renders default fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild message="test crash" />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('test crash')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reload page' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument()
  })

  it('calls window.location.reload when reload button is clicked', async () => {
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    })

    render(
      <ErrorBoundary>
        <ThrowingChild message="crash" />
      </ErrorBoundary>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Reload page' }))
    expect(reloadMock).toHaveBeenCalledOnce()
  })

  it('resets error state when try again button is clicked', async () => {
    let shouldThrow = true
    const ConditionalChild = () => {
      if (shouldThrow) {
        throw new Error('conditional crash')
      }
      return <p>recovered content</p>
    }

    render(
      <ErrorBoundary>
        <ConditionalChild />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    shouldThrow = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByText('recovered content')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary
        fallback={({ error, resetError }) => (
          <div>
            <span>custom: {error.message}</span>
            <button type="button" onClick={resetError}>
              custom reset
            </button>
          </div>
        )}
      >
        <ThrowingChild message="custom test" />
      </ErrorBoundary>,
    )

    expect(screen.getByText('custom: custom test')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'custom reset' }),
    ).toBeInTheDocument()
  })

  it('renders fallback with empty error message', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild message="" />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument()
  })

  it('logs error to console via componentDidCatch', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowingChild message="logged error" />
      </ErrorBoundary>,
    )

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ErrorBoundary] Uncaught error:',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    )
  })
})
