/**
 * App bar: open report, title slot, account menu, theme toggle and settings/roster slots.
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
import { useWclRateLimit } from '@/hooks/use-wcl-rate-limit'
import { defaultHost } from '@/lib/constants'
import { buildBossKillNavigationFights } from '@/lib/fight-navigation'
import { superKey } from '@/lib/keyboard-shortcut'
import { parseReportInput } from '@/lib/wcl-url'
import { ChevronDown, Home, Menu, RefreshCw, Search } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import { type FC, useEffect, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Link, useNavigate } from 'react-router-dom'

import { useAppShell } from '../routes/app-shell-context'

const warcraftLogsHomeUrl = 'https://www.warcraftlogs.com'
const authControlWidthClass = 'w-40 max-[760px]:w-auto max-[760px]:max-w-32'
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
  isRailOpen?: boolean
  onOpenRail?: () => void
  onReportError: (message: string | null) => void
}

// Below 760px every bar control gets a 40px touch target.
const mobileHitTargetClassName =
  'max-[760px]:[&_button]:min-h-10 max-[760px]:[&_button]:min-w-10'

/** Top bar: home icon, open report, divider, title slot, account menu, theme toggle and settings/roster slots. Wraps below 760px. */
export const AppBar: FC<AppBarProps> = ({
  isLandingPage,
  isRailOpen = false,
  onOpenRail,
  onReportError,
}) => {
  const { barRosterToggle, barSettings, barTitle, barTitleTrailing } =
    useAppShell()
  const posthog = usePostHog()
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [isReportInputOpen, setIsReportInputOpen] = useState(false)
  const [reportInputValue, setReportInputValue] = useState('')
  const reportInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { addRecentReport, searchReports } = useReportIndex()
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
    <header
      className={`border-b border-border bg-card ${mobileHitTargetClassName}`}
      data-testid="app-bar"
    >
      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 max-[760px]:gap-x-1 max-[760px]:px-2 max-[760px]:py-1 min-[760px]:h-11 min-[760px]:flex-nowrap min-[760px]:py-0">
        {onOpenRail ? (
          <Button
            aria-expanded={isRailOpen}
            aria-label="Open sidebar"
            className="min-[760px]:hidden"
            size="icon"
            type="button"
            variant="ghost"
            onClick={onOpenRail}
          >
            <Menu aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
        <Link
          aria-label="Go to home"
          className="inline-flex shrink-0 items-center justify-center text-foreground max-[760px]:size-10"
          to="/"
        >
          <Home aria-hidden="true" className="size-4" />
        </Link>

        <div className="flex shrink-0 items-center justify-start">
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
                  onReportError(null)
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
                  className="flex items-center gap-1 text-xs text-muted-foreground max-[760px]:hidden"
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
        </div>

        <span
          aria-hidden="true"
          className="hidden h-5 w-px shrink-0 bg-border min-[760px]:block"
          data-testid="app-bar-divider"
        />

        <div
          className="order-last flex min-w-0 basis-full items-center gap-2 text-sm text-muted-foreground max-[760px]:flex-wrap max-[760px]:gap-y-1 min-[760px]:order-none min-[760px]:basis-0 min-[760px]:flex-1"
          data-testid="app-bar-title"
        >
          <div className="min-w-0 truncate max-[760px]:basis-full">
            {barTitle}
          </div>
          {barTitle && barTitleTrailing ? (
            <>
              <span aria-hidden="true" className="max-[760px]:hidden">
                ›
              </span>
              <div className="shrink-0 max-[760px]:min-w-0 max-[760px]:shrink">
                {barTitleTrailing}
              </div>
            </>
          ) : null}
        </div>

        <div className="ml-auto flex shrink-0 items-center justify-end gap-2 max-[760px]:gap-1 min-[760px]:ml-0">
          {!authEnabled ? (
            <span className="text-sm text-muted-foreground max-[760px]:text-xs">
              Auth disabled
            </span>
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
              aria-label="Sign in with WCL"
              className={`${authControlHeightClass} ${authControlWidthClass}`}
              disabled={isBusy}
              size="sm"
              type="button"
              variant="outline"
              onClick={startWclLogin}
            >
              <span className="max-[760px]:hidden">Sign in with WCL</span>
              <span className="min-[760px]:hidden">Sign in</span>
            </Button>
          )}
          <ModeToggle />
          {barSettings}
          {barRosterToggle}
        </div>
      </div>
    </header>
  )
}
