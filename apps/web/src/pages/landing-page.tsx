/**
 * Landing page for report loading via history and examples.
 */
import { useAuth } from '@/auth/auth-provider'
import { ArrowUp, X } from 'lucide-react'
import { type FC, useMemo, useState } from 'react'

import { AccountRecentReportsList } from '../components/account-recent-reports-list'
import { RecentReportsList } from '../components/recent-reports-list'
import { SectionCard } from '../components/section-card'
import { StarredGuildReportsList } from '../components/starred-guild-reports-list'
import { StarredReportsList } from '../components/starred-reports-list'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Kbd, KbdGroup } from '../components/ui/kbd'
import { useReportIndex } from '../hooks/use-report-index'
import { useUserSettings } from '../hooks/use-user-settings'
import { exampleReports } from '../lib/constants'
import { superKey } from '../lib/keyboard-shortcut'

const reportHintDismissedStorageKey = 'landing-report-hint-dismissed'

export const LandingPage: FC = () => {
  const { authEnabled, wclUserId } = useAuth()
  const {
    recentReports,
    removeRecentReport,
    personalReports: accountRecentReports,
    guildReports: starredGuildReports,
    isLoadingPersonalReports: isLoadingAccountReports,
    isRefreshingPersonalReports: isRefreshingAccountReports,
    personalReportsError: accountRecentReportsError,
    isLoadingGuildReports,
    isRefreshingGuildReports,
    guildReportsError: starredGuildReportsError,
    refreshPersonalReports: refreshAccountReports,
    refreshGuildReports,
  } = useReportIndex()
  const { settings, toggleStarredReport, unstarReport } = useUserSettings()
  const trackedGuildCount = useMemo(
    () =>
      settings.starredEntities.filter((entry) => entry.entityType === 'guild')
        .length,
    [settings.starredEntities],
  )
  const isPersonalLogsEnabled = authEnabled && Boolean(wclUserId)
  const starredReportIds = useMemo(
    () => new Set(settings.starredReports.map((report) => report.reportId)),
    [settings.starredReports],
  )
  const unstarredRecentReports = useMemo(
    () =>
      recentReports.filter((report) => !starredReportIds.has(report.reportId)),
    [recentReports, starredReportIds],
  )
  const [isReportHintDismissed, setIsReportHintDismissed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.localStorage.getItem(reportHintDismissedStorageKey) === 'true'
  })

  return (
    <div className="space-y-5">
      {!isReportHintDismissed ? (
        <section aria-label="Report input guidance">
          <div className="relative overflow-hidden rounded-lg border border-border/80 bg-gradient-to-r from-panel via-panel to-primary/5 p-4 sm:p-5">
            <div className="pointer-events-none absolute left-10 top-0 h-4 w-4 -translate-y-1/2 rotate-45 border-l border-t border-border/80 bg-panel" />
            <Button
              aria-label="Dismiss report input guidance"
              className="absolute right-2 top-2"
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={() => {
                window.localStorage.setItem(
                  reportHintDismissedStorageKey,
                  'true',
                )
                setIsReportHintDismissed(true)
              }}
            >
              <X aria-hidden="true" className="size-4" />
            </Button>

            <div className="pr-8">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <ArrowUp
                  aria-hidden="true"
                  className="size-4 text-primary motion-safe:animate-bounce"
                />
                Paste a report into the input above
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>or use</span>
                <KbdGroup>
                  <Kbd>{superKey()}</Kbd>
                  <span>+</span>
                  <Kbd>O</Kbd>
                </KbdGroup>
                <span>to focus it instantly.</span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        <SectionCard
          title="Recent logs"
          subtitle="Starred reports are pinned first. Recent reports are shown below."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Starred
              </h3>
              <StarredReportsList
                reports={settings.starredReports}
                onToggleStarReport={(reportId) => {
                  void unstarReport(reportId)
                }}
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recent
              </h3>
              <RecentReportsList
                exampleReports={exampleReports}
                onRemoveReport={(reportId) => {
                  removeRecentReport(reportId)
                }}
                onToggleStarReport={(report) => {
                  void toggleStarredReport(report)
                }}
                reports={unstarredRecentReports}
                starredReportIds={starredReportIds}
              />
            </div>
          </div>
        </SectionCard>
        <SectionCard
          headerRight={
            <Button
              disabled={isRefreshingGuildReports || trackedGuildCount === 0}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                void refreshGuildReports()
              }}
            >
              {isRefreshingGuildReports ? 'Refreshing...' : 'Refresh'}
            </Button>
          }
          title="Guild logs"
          subtitle={`Reports from ${trackedGuildCount} starred ${trackedGuildCount === 1 ? 'guild' : 'guilds'} (cached 1 hour).`}
        >
          {isLoadingGuildReports ? (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Loading starred guild reports...
            </p>
          ) : starredGuildReportsError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {starredGuildReportsError.message}
              </AlertDescription>
            </Alert>
          ) : (
            <StarredGuildReportsList reports={starredGuildReports} />
          )}
        </SectionCard>
        <SectionCard
          headerRight={
            isPersonalLogsEnabled ? (
              <Button
                disabled={isRefreshingAccountReports}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  void refreshAccountReports()
                }}
              >
                {isRefreshingAccountReports ? 'Refreshing...' : 'Refresh'}
              </Button>
            ) : undefined
          }
          title="Personal logs"
          subtitle="Latest logs for your signed-in account."
        >
          {isPersonalLogsEnabled ? (
            isLoadingAccountReports ? (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                Loading recent Warcraft Logs...
              </p>
            ) : accountRecentReportsError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {accountRecentReportsError.message}
                </AlertDescription>
              </Alert>
            ) : (
              <AccountRecentReportsList reports={accountRecentReports} />
            )
          ) : (
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowUp
                  aria-hidden="true"
                  className="size-4 text-primary motion-safe:animate-bounce"
                />
                Sign in for personal logs.
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
