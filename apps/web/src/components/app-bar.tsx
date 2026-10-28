/**
 * App bar: report input, starred reports, theme toggle and account menu.
 */
import { getReport } from '@/api/reports'
import { useAuth } from '@/auth/auth-provider'
import { ModeToggle } from '@/components/mode-toggle'
import { ReportUrlForm } from '@/components/report-url-form'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useReportIndex } from '@/hooks/use-report-index'
import { useUserSettings } from '@/hooks/use-user-settings'
import { useWclRateLimit } from '@/hooks/use-wcl-rate-limit'
import { defaultHost } from '@/lib/constants'
import { buildBossKillNavigationFights } from '@/lib/fight-navigation'
import { superKey } from '@/lib/keyboard-shortcut'
import { parseReportInput } from '@/lib/wcl-url'
import { ChevronDown, Home, RefreshCw, Search, Star } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import { type FC, useEffect, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Link, useNavigate } from 'react-router-dom'

import { useAppShell } from '../routes/app-shell-context'

const warcraftLogsHomeUrl = 'https://www.warcraftlogs.com'
const authControlWidthClass = 'w-40'
const authControlHeightClass = 'h-[30px]'

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

interface AppBarProps {
  isLandingPage: boolean
  onReportError: (message: string | null) => void
}

/** Top bar: home link, report input, starred reports, theme toggle and account menu. */
export const AppBar: FC<AppBarProps> = ({ isLandingPage, onReportError }) => {
  const { barTitle } = useAppShell()
  const posthog = usePostHog()
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [isReportInputOpen, setIsReportInputOpen] = useState(false)
  const [reportInputValue, setReportInputValue] = useState('')
  const reportInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { addRecentReport, searchReports } = useReportIndex()
  const { settings, isLoading: isUserSettingsLoading } = useUserSettings()
  const {
    authEnabled,
    isBusy,
    isInitializing,
    signOut,
    startWclLogin,
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
    'mod+o',
    (event) => {
      event.preventDefault()
      setIsReportInputOpen(true)
      requestAnimationFrame(() => {
        reportInputRef.current?.focus()
      })
    },
    {
      description: 'Open report input',
      enableOnFormTags: true,
      metadata: {
        order: 90,
        showInFightOverlay: true,
      },
    },
  )

  const isReportInputVisible = isLandingPage || isReportInputOpen
  const reportSuggestions = useMemo(
    () => (isReportInputVisible ? searchReports(reportInputValue, 20) : []),
    [isReportInputVisible, reportInputValue, searchReports],
  )
  const isWclAuthenticated = Boolean(wclUserId)
  const shouldShowStarredDropdown = isWclAuthenticated && !isLandingPage
  const displayUserName = wclUserName ?? 'Warcraft Logs user'
  const handleAccountMenuOpenChange = (nextOpen: boolean): void => {
    setIsAccountMenuOpen(nextOpen)
    if (nextOpen) {
      void refreshRateLimit()
    }
  }
  const handleReportSubmit = async (input: string): Promise<void> => {
    const parsed = parseReportInput(input, defaultHost)
    if (!parsed) {
      onReportError(
        'Unable to parse report input. Use a fresh/sod/vanilla report URL or a report code.',
      )
      return
    }

    setReportInputValue('')
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
        onReportError(
          'This report is archived or inaccessible, so it cannot be opened here.',
        )
        return
      }

      onReportError(null)
      posthog?.capture('search_used', { search_type: 'report' })
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
      onReportError(message)
    } finally {
      setIsSubmittingReport(false)
    }
  }

  return (
    <header className="border-b border-border bg-card" data-testid="app-bar">
      <div className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
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
                ? 'max-w-[500px] opacity-100'
                : 'max-w-0 opacity-0 pointer-events-none'
            }`}
          >
            <div
              className={`w-full transition-all duration-200 ${
                isReportInputVisible ? 'translate-x-0' : '-translate-x-1'
              }`}
            >
              <ReportUrlForm
                className="flex w-[460px] max-w-[calc(100vw-7rem)] items-end gap-2"
                inputRef={reportInputRef}
                isSubmitting={isSubmittingReport}
                inputAriaLabel="Open report"
                onSelectSuggestion={(suggestion) => {
                  setReportErrorMessage(null)
                  setReportInputValue('')
                  navigate(`/report/${suggestion.reportId}`, {
                    state: {
                      host: suggestion.sourceHost,
                    },
                  })
                  if (!isLandingPage) {
                    setIsReportInputOpen(false)
                  }
                }}
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
                suggestions={reportSuggestions}
                submitIconOnly={!isLandingPage}
                value={reportInputValue}
                onValueChange={setReportInputValue}
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
          {barTitle ? (
            <div
              className="ml-3 min-w-0 truncate text-sm text-muted-foreground"
              data-testid="app-bar-title"
            >
              {barTitle}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2">
          <ModeToggle />
          {!authEnabled ? (
            <span className="text-sm text-muted-foreground">Auth disabled</span>
          ) : isInitializing ? (
            <Skeleton
              aria-hidden="true"
              className={`${authControlHeightClass} ${authControlWidthClass}`}
              data-testid="auth-header-loading-skeleton"
            />
          ) : isWclAuthenticated ? (
            <DropdownMenu
              open={isAccountMenuOpen}
              onOpenChange={handleAccountMenuOpenChange}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  className={`${authControlHeightClass} ${authControlWidthClass} justify-between gap-2`}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <span className="truncate">{displayUserName}</span>
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
                          disabled={isRateLimitLoading || isRateLimitRefreshing}
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
            <Skeleton
              aria-live="polite"
              className={`${authControlHeightClass} ${authControlWidthClass} flex items-center justify-center`}
              data-testid="auth-header-busy-skeleton"
            >
              <span className="text-[11px] font-medium text-muted-foreground">
                Logging in...
              </span>
            </Skeleton>
          ) : (
            <Button
              className={`${authControlHeightClass} ${authControlWidthClass}`}
              disabled={isBusy}
              size="sm"
              type="button"
              variant="outline"
              onClick={startWclLogin}
            >
              Sign in with WCL
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
