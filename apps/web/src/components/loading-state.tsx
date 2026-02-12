/**
 * Simple loading panel used across pages.
 */
import type { FC } from 'react'

export type LoadingStateProps = {
  message: string
}

export const LoadingState: FC<LoadingStateProps> = ({ message }) => {
  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-border bg-panel p-6 shadow-sm"
      role="status"
    >
      <p className="text-sm text-muted">{message}</p>
    </section>
  )
}
