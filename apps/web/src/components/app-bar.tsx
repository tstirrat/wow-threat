/**
 * App bar: open report, report/fight/target breadcrumb, and WCL link, settings and roster slots.
 */
import { getReport } from '@/api/reports'
import { ReportUrlForm } from '@/components/report-url-form'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useReportIndex } from '@/hooks/use-report-index'
import { defaultHost } from '@/lib/constants'
import { buildBossKillNavigationFights } from '@/lib/fight-navigation'
import { superKey } from '@/lib/keyboard-shortcut'
import { parseReportInput } from '@/lib/wcl-url'
import { Menu, Search } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import { type FC, useEffect, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'

import { useAppShell } from '../routes/app-shell-context'

interface AppBarProps {
  isLandingPage: boolean
  isRailOpen?: boolean
  onOpenRail?: () => void
  onReportError: (message: string | null) => void
}

// Below 760px every bar control gets a 40px touch target.
const mobileHitTargetClassName =
  'max-[760px]:[&_button]:min-h-10 max-[760px]:[&_button]:min-w-10'

/** Top bar: open report, report › fight › target breadcrumb, WCL link, settings and roster slots. Wraps to two rows below 760px. */
export const AppBar: FC<AppBarProps> = ({
  isLandingPage,
  isRailOpen = false,
  onOpenRail,
  onReportError,
}) => {
  const {
    barExternalLink,
    barRosterToggle,
    barSettings,
    barTitle,
    barTitleTrailing,
  } = useAppShell()
  const posthog = usePostHog()
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [isReportInputOpen, setIsReportInputOpen] = useState(false)
  const [reportInputValue, setReportInputValue] = useState('')
  const reportInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { addRecentReport, searchReports } = useReportIndex()
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
    <TooltipProvider delayDuration={0}>
      <header
        className={`border-b border-border surface-chrome ${mobileHitTargetClassName}`}
        data-testid="app-bar"
      >
        <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 max-[760px]:gap-x-1 max-[760px]:px-2 max-[760px]:py-1 min-[760px]:h-11 min-[760px]:flex-nowrap min-[760px]:py-0">
          {onOpenRail ? (
            <Button
              aria-expanded={isRailOpen}
              aria-label="Open sidebar"
              className="min-[760px]:hidden max-[760px]:order-1"
              size="icon"
              type="button"
              variant="ghost"
              onClick={onOpenRail}
            >
              <Menu aria-hidden="true" className="size-4" />
            </Button>
          ) : null}

          <div className="flex shrink-0 items-center justify-start max-[760px]:order-2">
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
              <div
                aria-hidden={isReportInputOpen}
                data-testid="report-input-minimized"
                className={`flex items-center transition-all duration-200 ${
                  isReportInputOpen
                    ? 'max-w-0 opacity-0 pointer-events-none -translate-x-1'
                    : 'max-w-xs opacity-100 translate-x-0'
                }`}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Open report input"
                      className="gap-1.5 max-[760px]:px-0"
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setIsReportInputOpen(true)
                        requestAnimationFrame(() => {
                          reportInputRef.current?.focus()
                        })
                      }}
                    >
                      <Search aria-hidden="true" className="size-4" />
                      <span className="max-[760px]:hidden">Open report</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" withArrow>
                    Open a report ({superKey()}+O)
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : null}
          </div>

          <div
            className="flex min-w-0 flex-1 items-center gap-1 text-sm text-muted-foreground max-[760px]:contents"
            data-testid="app-bar-title"
          >
            {barTitle}
            {barExternalLink ? (
              <div className="flex shrink-0 items-center max-[760px]:order-8">
                {barExternalLink}
              </div>
            ) : null}
            {barTitle && barTitleTrailing ? (
              <span className="flex min-w-0 shrink items-center gap-1 max-[760px]:order-7 max-[760px]:flex-1">
                <span aria-hidden="true" className="max-[760px]:hidden">
                  ›
                </span>
                <span className="min-w-0 max-[760px]:flex-1">
                  {barTitleTrailing}
                </span>
              </span>
            ) : null}
          </div>
          {barTitle && barTitleTrailing ? (
            <span
              aria-hidden="true"
              className="hidden h-0 basis-full max-[760px]:order-6 max-[760px]:block"
            />
          ) : null}

          <div className="flex shrink-0 items-center justify-end gap-1 max-[760px]:contents">
            <div className="flex items-center max-[760px]:order-4">
              {barSettings}
            </div>
            <div className="flex items-center max-[760px]:order-5">
              {barRosterToggle}
            </div>
          </div>
        </div>
      </header>
    </TooltipProvider>
  )
}
