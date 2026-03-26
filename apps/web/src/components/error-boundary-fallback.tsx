/**
 * Default fallback UI rendered by ErrorBoundary when no custom fallback is provided.
 */
import type { FC } from 'react'

import type { ErrorBoundaryFallbackProps } from './error-boundary'
import { Button } from './ui/button'

/** Centered error message with try-again and reload buttons. */
export const ErrorBoundaryFallback: FC<ErrorBoundaryFallbackProps> = ({
  error,
  resetError,
}) => (
  <div
    role="alert"
    className="flex min-h-[50vh] items-center justify-center px-4"
  >
    <div className="flex max-w-md flex-col items-center gap-4 text-center">
      <h2 className="text-lg font-semibold text-foreground">
        Something went wrong
      </h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={resetError}>
          Try again
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={() => {
            window.location.reload()
          }}
        >
          Reload page
        </Button>
      </div>
    </div>
  </div>
)
