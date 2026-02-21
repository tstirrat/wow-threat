/**
 * Shared app shell for all routed pages.
 */
import { useAuth } from '@/auth/auth-provider'
import { ModeToggle } from '@/components/mode-toggle'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { FC } from 'react'
import { Link, Outlet } from 'react-router-dom'

export const RootLayout: FC = () => {
  const {
    authEnabled,
    authError,
    isBusy,
    isInitializing,
    signOut,
    startWclLogin,
    user,
  } = useAuth()
  const shouldShowAuthGate = authEnabled && !isInitializing && !user
  const isSignInInProgress = shouldShowAuthGate && isBusy

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
                {isBusy ? 'Finishing sign-in...' : 'Sign in with Warcraft Logs'}
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        {authEnabled && authError ? (
          <Alert aria-live="assertive" className="mb-4" variant="destructive">
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        ) : null}
        {authEnabled && isInitializing ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Checking authentication</h2>
            <p className="text-sm text-muted-foreground">
              Restoring your Firebase session...
            </p>
          </section>
        ) : shouldShowAuthGate ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              {isSignInInProgress ? 'Completing sign-in' : 'Sign in required'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isSignInInProgress
                ? 'Finalizing Warcraft Logs authentication. This can take a moment after the pop-up closes.'
                : 'Use Warcraft Logs OAuth to authenticate before loading report data.'}
            </p>
            {isSignInInProgress ? (
              <p
                aria-live="polite"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground"
                role="status"
              >
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Finishing authentication...
              </p>
            ) : (
              <Button disabled={isBusy} type="button" onClick={startWclLogin}>
                Continue with Warcraft Logs
              </Button>
            )}
          </section>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
