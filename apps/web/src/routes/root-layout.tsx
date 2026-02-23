/**
 * Shared app shell for all routed pages.
 */
import { useAuth } from '@/auth/auth-provider'
import { ModeToggle } from '@/components/mode-toggle'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWclRateLimit } from '@/hooks/use-wcl-rate-limit'
import { ChevronDown, Loader2, RefreshCw } from 'lucide-react'
import { type FC, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'

const warcraftLogsHomeUrl = 'https://www.warcraftlogs.com'

function formatResetDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }

  return `${seconds}s`
}

function formatSpentPoints(pointsSpentThisHour: number): string {
  return String(Math.max(0, Math.floor(pointsSpentThisHour)))
}

export const RootLayout: FC = () => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const {
    authEnabled,
    authError,
    isBusy,
    isInitializing,
    signOut,
    startWclLogin,
    user,
    wclUserId,
    wclUserName,
  } = useAuth()
  const {
    rateLimit,
    isLoading: isRateLimitLoading,
    isRefreshing: isRateLimitRefreshing,
    error: rateLimitError,
    refresh: refreshRateLimit,
  } = useWclRateLimit()
  const shouldShowAuthGate = authEnabled && !isInitializing && !user
  const isSignInInProgress = shouldShowAuthGate && isBusy
  const displayUserName =
    wclUserName ?? user?.displayName ?? user?.uid ?? 'Warcraft Logs user'
  const handleAccountMenuOpenChange = (nextOpen: boolean): void => {
    setIsAccountMenuOpen(nextOpen)
    if (nextOpen) {
      void refreshRateLimit()
    }
  }

  return (
    <div className="min-h-screen text-text">
      <header className="border-b border-border bg-panel">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">
            <Link to="/">WoW Threat</Link>
          </h1>
          <div className="flex items-center gap-2">
            <ModeToggle />
            {!authEnabled ? (
              <span className="text-sm text-muted-foreground">
                Auth disabled
              </span>
            ) : user ? (
              <DropdownMenu
                open={isAccountMenuOpen}
                onOpenChange={handleAccountMenuOpenChange}
              >
                <DropdownMenuTrigger asChild>
                  <Button size="sm" type="button" variant="outline">
                    {displayUserName}
                    <ChevronDown aria-hidden="true" className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>{displayUserName}</DropdownMenuLabel>
                  {wclUserId ? (
                    <DropdownMenuLabel className="pt-0">
                      WCL ID: {wclUserId}
                    </DropdownMenuLabel>
                  ) : null}
                  {rateLimit ? (
                    <>
                      <DropdownMenuLabel className="pt-0 text-xs font-normal text-muted-foreground">
                        <span className="flex items-center justify-between gap-2">
                          <span>
                            Spent:{' '}
                            {formatSpentPoints(rateLimit.pointsSpentThisHour)}/
                            {rateLimit.limitPerHour}
                          </span>
                          <Button
                            aria-label="Refresh WCL rate limit"
                            disabled={
                              isRateLimitLoading || isRateLimitRefreshing
                            }
                            size="icon-xs"
                            type="button"
                            variant="ghost"
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              void refreshRateLimit()
                            }}
                          >
                            <RefreshCw
                              aria-hidden="true"
                              className={
                                isRateLimitRefreshing ? 'animate-spin' : ''
                              }
                            />
                          </Button>
                        </span>
                      </DropdownMenuLabel>
                      <DropdownMenuLabel className="pt-0 text-xs font-normal text-muted-foreground">
                        Reset: {formatResetDuration(rateLimit.pointsResetIn)}
                      </DropdownMenuLabel>
                    </>
                  ) : null}
                  {!rateLimit && isRateLimitLoading ? (
                    <DropdownMenuLabel className="pt-0 text-xs font-normal text-muted-foreground">
                      Loading API usage...
                    </DropdownMenuLabel>
                  ) : null}
                  {!rateLimit && !isRateLimitLoading && rateLimitError ? (
                    <DropdownMenuLabel className="pt-0 text-xs font-normal text-muted-foreground">
                      API usage unavailable
                    </DropdownMenuLabel>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a
                      href={warcraftLogsHomeUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Warcraft Logs
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={isBusy}
                    variant="destructive"
                    onClick={() => {
                      void signOut()
                    }}
                  >
                    {isBusy ? 'Signing out...' : 'Sign out'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : isBusy ? (
              <span
                aria-live="polite"
                className="text-sm text-muted-foreground"
              >
                Logging in...
              </span>
            ) : isInitializing ? (
              <span className="text-sm text-muted-foreground">
                Checking auth...
              </span>
            ) : (
              <Button
                disabled={isBusy}
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
