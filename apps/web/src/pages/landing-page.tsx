/**
 * Landing page for report loading via URL, history, and examples.
 */
import { useAuth } from '@/auth/auth-provider'
import { type FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AccountRecentReportsList } from '../components/account-recent-reports-list'
import { ExampleReportList } from '../components/example-report-list'
import { RecentReportsList } from '../components/recent-reports-list'
import { ReportUrlForm } from '../components/report-url-form'
import { SectionCard } from '../components/section-card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { useRecentReports } from '../hooks/use-recent-reports'
import { useUserRecentReports } from '../hooks/use-user-recent-reports'
import { defaultHost, exampleReports } from '../lib/constants'
import { parseReportInput } from '../lib/wcl-url'

export const LandingPage: FC = () => {
  const navigate = useNavigate()
  const { authEnabled, user } = useAuth()
  const { recentReports, addRecentReport, removeRecentReport } =
    useRecentReports()
  const {
    reports: accountRecentReports,
    isLoading: isLoadingAccountReports,
    error: accountRecentReportsError,
  } = useUserRecentReports(10)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const shouldShowAccountReports = authEnabled && Boolean(user)

  return (
    <div className="space-y-5">
      <SectionCard
        title="Load report"
        subtitle="Paste a Warcraft Logs report URL or report ID to open threat views."
      >
        <ReportUrlForm
          onSubmit={(input) => {
            const parsed = parseReportInput(input, defaultHost)
            if (!parsed) {
              setErrorMessage(
                'Unable to parse report input. Use a fresh/sod/vanilla report URL or a report code.',
              )
              return
            }

            setErrorMessage(null)
            addRecentReport({
              reportId: parsed.reportId,
              title: parsed.reportId,
              sourceHost: parsed.host,
              lastOpenedAt: Date.now(),
            })

            navigate(`/report/${parsed.reportId}`, {
              state: {
                host: parsed.host,
              },
            })
          }}
        />
        {errorMessage ? (
          <Alert aria-live="polite" className="mt-3" variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Recent reports"
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
