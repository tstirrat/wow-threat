/**
 * Shared app shell for all routed pages.
 */
import type { FC } from 'react'
import { Link, Outlet } from 'react-router-dom'

export const RootLayout: FC = () => {
  return (
    <div className="min-h-screen text-text">
      <header className="border-b border-border bg-panel">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">
            <Link to="/">WCL Threat</Link>
          </h1>
          <span className="text-sm text-muted">Development mode</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
