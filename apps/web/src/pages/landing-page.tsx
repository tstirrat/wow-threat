/**
 * Landing page for report loading via URL, history, and examples.
 */
import { useState, type FC } from 'react'
import { useNavigate } from 'react-router-dom'

import { ExampleReportList } from '../components/example-report-list'
import { RecentReportsList } from '../components/recent-reports-list'
import { ReportUrlForm } from '../components/report-url-form'
import { SectionCard } from '../components/section-card'
import { defaultHost, exampleReports } from '../lib/constants'
import { parseReportInput } from '../lib/wcl-url'
import { useRecentReports } from '../hooks/use-recent-reports'

export const LandingPage: FC = () => {
  const navigate = useNavigate()
  const { recentReports, addRecentReport } = useRecentReports()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
          <p aria-live="polite" className="mt-3 text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Recent reports"
        subtitle="Most recently loaded report codes in this browser context."
      >
        <RecentReportsList reports={recentReports} />
      </SectionCard>

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
