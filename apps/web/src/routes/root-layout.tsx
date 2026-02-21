/**
 * Shared app shell for all routed pages.
 */
import { useAuth } from '@/auth/auth-provider'
import { ModeToggle } from '@/components/mode-toggle'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { FC } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

export const RootLayout: FC = () => {
  const location = useLocation()
  const {
    authEnabled,
    authError,
    isBusy,
    isInitializing,
    signOut,
    startWclLogin,
    user,
  } = useAuth()
  const isAuthCompleteRoute = location.pathname === '/auth/complete'
  const shouldShowAuthGate =
    authEnabled && !isAuthCompleteRoute && !isInitializing && !user

  return (
    <div className="min-h-screen text-text">
      <header className="border-b border-border bg-panel">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">
            <Link to="/">WCL Threat</Link>
          </h1>
          <div className="flex items-center gap-2">
            <ModeToggle />
            {!authEnabled ? (
              <span className="text-sm text-muted-foreground">
                Auth disabled
              </span>
            ) : user ? (
              <>
                <span className="text-sm text-muted-foreground">
                  Signed in as {user.uid}
                </span>
                <Button
                  disabled={isBusy}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void signOut()
                  }}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <Button
                disabled={isBusy || isInitializing}
                size="sm"
                type="button"
                onClick={startWclLogin}
              >
                Sign in with Warcraft Logs
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        {authEnabled && !isAuthCompleteRoute && authError ? (
          <Alert aria-live="assertive" className="mb-4" variant="destructive">
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        ) : null}
        {authEnabled && isInitializing && !isAuthCompleteRoute ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Checking authentication</h2>
            <p className="text-sm text-muted-foreground">
              Restoring your Firebase session...
            </p>
          </section>
        ) : shouldShowAuthGate ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Sign in required</h2>
            <p className="text-sm text-muted-foreground">
              Use Warcraft Logs OAuth to authenticate before loading report
              data.
            </p>
            <Button disabled={isBusy} type="button" onClick={startWclLogin}>
              Continue with Warcraft Logs
            </Button>
          </section>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
