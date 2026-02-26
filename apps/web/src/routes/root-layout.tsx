/**
 * Shared app shell for all routed pages.
 */
import { getReport } from '@/api/reports'
import { useAuth } from '@/auth/auth-provider'
import { ModeToggle } from '@/components/mode-toggle'
import { ReportUrlForm } from '@/components/report-url-form'
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
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useRecentReports } from '@/hooks/use-recent-reports'
import { useUserSettings } from '@/hooks/use-user-settings'
import { useWclRateLimit } from '@/hooks/use-wcl-rate-limit'
import { defaultHost } from '@/lib/constants'
import { buildBossKillNavigationFights } from '@/lib/fight-navigation'
import { superKey } from '@/lib/keyboard-shortcut'
import { parseReportInput } from '@/lib/wcl-url'
import {
  ChevronDown,
  Home,
  Loader2,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react'
import { type FC, useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'

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
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [reportErrorMessage, setReportErrorMessage] = useState<string | null>(
    null,
  )
  const [isReportInputOpen, setIsReportInputOpen] = useState(false)
  const reportInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const isLandingPage = location.pathname === '/'
  const { addRecentReport } = useRecentReports()
  const { settings, isLoading: isUserSettingsLoading } = useUserSettings()
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

  useEffect(() => {
    if (isLandingPage) {
      setIsReportInputOpen(true)
      return
    }

    setIsReportInputOpen(false)
  }, [isLandingPage])

  useHotkeys(
    'meta+o,ctrl+o',
    (event) => {
      event.preventDefault()
      setIsReportInputOpen(true)
      requestAnimationFrame(() => {
        reportInputRef.current?.focus()
      })
    },
    {
      enableOnFormTags: false,
    },
  )

  const shouldShowAuthGate = authEnabled && !isInitializing && !user
  const isReportInputVisible = isLandingPage || isReportInputOpen
  const isSignInInProgress = shouldShowAuthGate && isBusy
  const shouldShowStarredDropdown = Boolean(user) && !isLandingPage
  const displayUserName =
    wclUserName ?? user?.displayName ?? user?.uid ?? 'Warcraft Logs user'
  const handleAccountMenuOpenChange = (nextOpen: boolean): void => {
    setIsAccountMenuOpen(nextOpen)
    if (nextOpen) {
      void refreshRateLimit()
    }
  }
  const handleReportSubmit = async (input: string): Promise<void> => {
    const parsed = parseReportInput(input, defaultHost)
    if (!parsed) {
      setReportErrorMessage(
        'Unable to parse report input. Use a fresh/sod/vanilla report URL or a report code.',
      )
      return
    }

    setIsSubmittingReport(true)
    try {
      const report = await getReport(parsed.reportId)
      const isArchived = report.archiveStatus?.isArchived ?? false
      const isAccessible = report.archiveStatus?.isAccessible ?? true

      addRecentReport({
        reportId: parsed.reportId,
        title: report.title,
        sourceHost: parsed.host,
        lastOpenedAt: Date.now(),
        zoneName: report.zone?.name,
        startTime: report.startTime,
        bossKillCount: buildBossKillNavigationFights(report.fights).length,
        guildName: report.guild?.name ?? null,
        guildFaction: report.guild?.faction ?? null,
        isArchived,
        isAccessible,
        archiveDate: report.archiveStatus?.archiveDate ?? null,
      })

      if (isArchived || !isAccessible) {
        setReportErrorMessage(
          'This report is archived or inaccessible, so it cannot be opened here.',
        )
        return
      }

      setReportErrorMessage(null)
      navigate(`/report/${parsed.reportId}`, {
        state: {
          host: parsed.host,
        },
      })
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load report metadata.'
      setReportErrorMessage(message)
    } finally {
      setIsSubmittingReport(false)
    }
  }

  return (
    <div className="min-h-screen text-text">
      <header className="border-b border-border bg-panel">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold">
            <Link
              aria-label="Go to home"
              className="inline-flex items-center gap-2"
              to="/"
            >
              <Home aria-hidden="true" className="size-4" />
              <span>WoW Threat</span>
            </Link>
          </h1>

          <div className="flex items-center justify-start">
            <div
              aria-hidden={!isReportInputVisible}
              data-testid="report-input-container"
              className={`overflow-hidden transition-all duration-200 ${
                isReportInputVisible
                  ? 'max-w-xl opacity-100'
                  : 'max-w-0 opacity-0 pointer-events-none'
              }`}
            >
              <div
                className={`w-full transition-all duration-200 ${
                  isReportInputVisible ? 'translate-x-0' : '-translate-x-1'
                }`}
              >
                <ReportUrlForm
                  className="flex w-full items-end gap-2"
                  inputRef={reportInputRef}
                  isSubmitting={isSubmittingReport}
                  inputAriaLabel="Open report"
                  onInputBlur={() => {
                    if (!isLandingPage) {
                      setIsReportInputOpen(false)
                    }
                  }}
                  onInputEscape={() => {
                    if (!isLandingPage) {
                      setIsReportInputOpen(false)
                    }
                  }}
                  placeholder={`Paste Warcraft Logs report URL or report ID (${superKey()}+O)`}
                  submitIconOnly={!isLandingPage}
                  onSubmit={(input) => {
                    void handleReportSubmit(input)
                  }}
                />
              </div>
            </div>
            {!isLandingPage ? (
              <TooltipProvider delayDuration={0}>
                <div
                  aria-hidden={isReportInputOpen}
                  data-testid="report-input-minimized"
                  className={`flex items-center gap-2 transition-all duration-200 ${
                    isReportInputOpen
                      ? 'max-w-0 opacity-0 pointer-events-none -translate-x-1'
                      : 'max-w-xs opacity-100 translate-x-0'
                  }`}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label="Open report input"
                        size="icon"
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsReportInputOpen(true)
                          requestAnimationFrame(() => {
                            reportInputRef.current?.focus()
                          })
                        }}
                      >
                        <Search aria-hidden="true" className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" withArrow>
                      Open a report
                    </TooltipContent>
                  </Tooltip>
                  <div
                    aria-label="Report input shortcut"
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <KbdGroup>
                      <Kbd>{superKey()}</Kbd>
                      <span>+</span>
                      <Kbd>O</Kbd>
                    </KbdGroup>
                  </div>
                </div>
              </TooltipProvider>
            ) : null}
            {shouldShowStarredDropdown ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="ml-2"
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Star aria-hidden="true" className="size-3.5" />
                    Starred
                    <ChevronDown aria-hidden="true" className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuLabel>Starred reports</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isUserSettingsLoading ? (
                    <DropdownMenuItem disabled>
                      Loading starred reports...
                    </DropdownMenuItem>
                  ) : settings.starredReports.length === 0 ? (
                    <DropdownMenuItem disabled>
                      No starred reports yet
                    </DropdownMenuItem>
                  ) : (
                    settings.starredReports.map((report) => (
                      <DropdownMenuItem asChild key={report.reportId}>
                        <Link
                          state={{ host: report.sourceHost }}
                          to={`/report/${report.reportId}`}
                        >
                          {report.title || report.reportId}
                        </Link>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2">
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
        {reportErrorMessage ? (
          <Alert aria-live="polite" className="mb-4" variant="destructive">
            <AlertDescription>{reportErrorMessage}</AlertDescription>
          </Alert>
        ) : null}
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
