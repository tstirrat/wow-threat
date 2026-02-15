/**
 * Error panel used across page-level query failures.
 */
import type { FC } from 'react'

export type ErrorStateProps = {
  title: string
  message: string
}

export const ErrorState: FC<ErrorStateProps> = ({ title, message }) => {
  return (
    <section
      aria-live="assertive"
      className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-900 shadow-sm"
      role="alert"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm">{message}</p>
    </section>
  )
}
