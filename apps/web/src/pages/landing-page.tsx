/**
 * Landing page for report loading via history and examples.
 */
import { useAuth } from '@/auth/auth-provider'
import { type FC } from 'react'

import { AccountRecentReportsList } from '../components/account-recent-reports-list'
import { ExampleReportList } from '../components/example-report-list'
import { RecentReportsList } from '../components/recent-reports-list'
import { SectionCard } from '../components/section-card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { useRecentReports } from '../hooks/use-recent-reports'
import { useUserRecentReports } from '../hooks/use-user-recent-reports'
import { exampleReports } from '../lib/constants'

export const LandingPage: FC = () => {
  const { authEnabled, user } = useAuth()
  const { recentReports, removeRecentReport } = useRecentReports()
  const {
    reports: accountRecentReports,
    isLoading: isLoadingAccountReports,
    isRefreshing: isRefreshingAccountReports,
    error: accountRecentReportsError,
    refresh: refreshAccountReports,
  } = useUserRecentReports(10)
  const shouldShowAccountReports = authEnabled && Boolean(user)

  return (
    <div className="space-y-5">
      <SectionCard
        title="Open a report"
        subtitle="Use the header input above to paste a Warcraft Logs URL or report code."
      >
        <p className="text-sm text-muted-foreground">
          Quick shortcut: press Cmd/Ctrl+O to focus the report input from
          anywhere.
        </p>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Recently viewed"
          subtitle="Most recently loaded report codes in this browser context."
        >
          <RecentReportsList
            onRemoveReport={(reportId) => {
              removeRecentReport(reportId)
            }}
            reports={recentReports}
          />
        </SectionCard>
        {shouldShowAccountReports ? (
          <SectionCard
            headerRight={
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
            }
            title="Recent Warcraft Logs"
            subtitle="Latest personal and guild logs for your signed-in account."
          >
            {isLoadingAccountReports ? (
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
            )}
          </SectionCard>
        ) : null}
      </div>

      {recentReports.length === 0 ? (
        <SectionCard
          title="Example reports"
          subtitle="Starter links for Fresh, Season of Discovery, and Vanilla Era."
        >
          <ExampleReportList examples={exampleReports} />
        </SectionCard>
      ) : null}
    </div>
  )
}
