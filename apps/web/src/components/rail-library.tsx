/**
 * Compact library for the app rail: starred, recent, guild and personal logs.
 */
import { useAuth } from '@/auth/auth-provider'
import type { PostHog } from 'posthog-js'
import { usePostHog } from 'posthog-js/react'
import {
  type FC,
  type PropsWithChildren,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
} from 'react'

import { useReportIndex } from '../hooks/use-report-index'
import { useUserSettings } from '../hooks/use-user-settings'
import { AccountRecentReportsList } from './account-recent-reports-list'
import { RecentReportsList } from './recent-reports-list'
import { StarredGuildReportsList } from './starred-guild-reports-list'
import { StarredReportsList } from './starred-reports-list'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'

function useGuildLogTracking({
  isLoadingGuildReports,
  guildReportCount,
  posthog,
}: {
  isLoadingGuildReports: boolean
  guildReportCount: number
  posthog?: PostHog
}): { trackGuildLogOpened: () => void } {
  const loadStartTimeRef = useRef<number | null>(null)
  const loadedTrackedRef = useRef(false)

  const trackGuildLogOpened = useCallback((): void => {
    posthog?.capture('guild_log_opened')
    loadStartTimeRef.current = performance.now()
    loadedTrackedRef.current = false
  }, [posthog])

  useEffect(() => {
    if (!posthog || loadedTrackedRef.current) return
    if (isLoadingGuildReports || guildReportCount === 0) return
    if (loadStartTimeRef.current === null) return
    loadedTrackedRef.current = true
    posthog.capture('guild_log_loaded', {
      report_count: guildReportCount,
      load_time_ms: Math.round(performance.now() - loadStartTimeRef.current),
    })
  }, [guildReportCount, isLoadingGuildReports, posthog])

  return { trackGuildLogOpened }
}

type RailLibrarySectionProps = PropsWithChildren<{
  title: string
  headerRight?: ReactNode
}>

const RailLibrarySection: FC<RailLibrarySectionProps> = ({
  title,
  headerRight,
  children,
}) => {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <h3
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          id={titleId}
        >
          {title}
        </h3>
        {headerRight}
      </div>
      {children}
    </section>
  )
}

const RefreshButton: FC<{
  isRefreshing: boolean
  isDisabled?: boolean
  onRefresh: () => void
}> = ({ isRefreshing, isDisabled = false, onRefresh }) => (
  <Button
    className="h-6 px-2 text-xs"
    disabled={isRefreshing || isDisabled}
    size="sm"
    type="button"
    variant="ghost"
    onClick={onRefresh}
  >
    {isRefreshing ? 'Refreshing...' : 'Refresh'}
  </Button>
)

export const RailLibrary: FC = () => {
  const { authEnabled, wclUserId } = useAuth()
  const {
    recentReports,
    removeRecentReport,
    personalReports,
    guildReports,
    isLoadingPersonalReports,
    isRefreshingPersonalReports,
    personalReportsError,
    isLoadingGuildReports,
    isRefreshingGuildReports,
    guildReportsError,
    refreshPersonalReports,
    refreshGuildReports,
  } = useReportIndex()
  const { settings, toggleStarredReport, unstarReport } = useUserSettings()
  const posthog = usePostHog()
  const { trackGuildLogOpened } = useGuildLogTracking({
    isLoadingGuildReports,
    guildReportCount: guildReports.length,
    posthog,
  })
  const trackedGuildCount = settings.starredEntities.filter(
    (entry) => entry.entityType === 'guild',
  ).length
  const isPersonalLogsEnabled = authEnabled && Boolean(wclUserId)
  const starredReportIds = new Set(
    settings.starredReports.map((report) => report.reportId),
  )
  const unstarredRecentReports = recentReports.filter(
    (report) => !starredReportIds.has(report.reportId),
  )

  return (
    <div className="space-y-4 p-3" data-testid="rail-library">
      <RailLibrarySection title="Starred">
        <StarredReportsList
          reports={settings.starredReports}
          onToggleStarReport={(reportId) => {
            void unstarReport(reportId)
          }}
        />
      </RailLibrarySection>
      <RailLibrarySection title="Recent logs">
        <RecentReportsList
          reports={unstarredRecentReports}
          starredReportIds={starredReportIds}
          onRemoveReport={removeRecentReport}
          onToggleStarReport={(report) => {
            void toggleStarredReport(report)
          }}
        />
      </RailLibrarySection>
      <RailLibrarySection
        headerRight={
          <RefreshButton
            isDisabled={trackedGuildCount === 0}
            isRefreshing={isRefreshingGuildReports}
            onRefresh={() => {
              trackGuildLogOpened()
              void refreshGuildReports()
            }}
          />
        }
        title="Guild logs"
      >
        <p className="text-xs text-muted-foreground">
          Reports from {trackedGuildCount} starred{' '}
          {trackedGuildCount === 1 ? 'guild' : 'guilds'} (cached 1 hour).
        </p>
        {isLoadingGuildReports ? (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Loading starred guild reports...
          </p>
        ) : guildReportsError ? (
          <Alert variant="destructive">
            <AlertDescription>{guildReportsError.message}</AlertDescription>
          </Alert>
        ) : (
          <StarredGuildReportsList reports={guildReports} />
        )}
      </RailLibrarySection>
      <RailLibrarySection
        headerRight={
          isPersonalLogsEnabled ? (
            <RefreshButton
              isRefreshing={isRefreshingPersonalReports}
              onRefresh={() => {
                void refreshPersonalReports()
              }}
            />
          ) : undefined
        }
        title="Personal logs"
      >
        {isPersonalLogsEnabled ? (
          isLoadingPersonalReports ? (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Loading recent Warcraft Logs...
            </p>
          ) : personalReportsError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {personalReportsError.message}
              </AlertDescription>
            </Alert>
          ) : (
            <AccountRecentReportsList reports={personalReports} />
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            Sign in for personal logs.
          </p>
        )}
      </RailLibrarySection>
    </div>
  )
}
