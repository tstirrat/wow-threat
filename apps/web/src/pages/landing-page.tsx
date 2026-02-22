/**
 * Landing page for report loading via URL, history, and examples.
 */
import { useAuth } from '@/auth/auth-provider'
import { type FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getReport } from '../api/reports'
import { AccountRecentReportsList } from '../components/account-recent-reports-list'
import { ExampleReportList } from '../components/example-report-list'
import { RecentReportsList } from '../components/recent-reports-list'
import { ReportUrlForm } from '../components/report-url-form'
import { SectionCard } from '../components/section-card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { useRecentReports } from '../hooks/use-recent-reports'
import { useUserRecentReports } from '../hooks/use-user-recent-reports'
import { defaultHost, exampleReports } from '../lib/constants'
import { buildBossKillNavigationFights } from '../lib/fight-navigation'
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const shouldShowAccountReports = authEnabled && Boolean(user)
  const handleReportSubmit = async (input: string): Promise<void> => {
    const parsed = parseReportInput(input, defaultHost)
    if (!parsed) {
      setErrorMessage(
        'Unable to parse report input. Use a fresh/sod/vanilla report URL or a report code.',
      )
      return
    }

    setIsSubmitting(true)
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
        setErrorMessage(
          'This report is archived or inaccessible, so it cannot be opened here.',
        )
        return
      }

      setErrorMessage(null)
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
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard
        title="Load report"
        subtitle="Paste a Warcraft Logs report URL or report ID to open threat views."
      >
        <ReportUrlForm
          isSubmitting={isSubmitting}
          onSubmit={(input) => {
            void handleReportSubmit(input)
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
