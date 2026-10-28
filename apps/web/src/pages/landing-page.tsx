/**
 * Landing page: a centred box for loading a report, with examples when there is no history.
 */
import { type FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ExampleReportList } from '../components/example-report-list'
import { ReportUrlForm } from '../components/report-url-form'
import { Alert, AlertDescription } from '../components/ui/alert'
import { useOpenReport } from '../hooks/use-open-report'
import { useReportIndex } from '../hooks/use-report-index'
import { exampleReports } from '../lib/constants'
import { superKey } from '../lib/keyboard-shortcut'

export const LandingPage: FC = () => {
  const navigate = useNavigate()
  const { recentReports, searchReports } = useReportIndex()
  const { errorMessage, isSubmitting, openReport } = useOpenReport()
  const [value, setValue] = useState('')

  return (
    <>
      <title>WOW Threat</title>
      <div className="flex min-h-full items-center justify-center p-4">
        <section
          aria-label="Open a report"
          className="w-full max-w-xl space-y-4 rounded-lg border border-border bg-card p-6"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              Open a Warcraft Logs report
            </h2>
            <p className="text-sm text-muted-foreground">
              Paste a report URL or ID, or press {superKey()}+O from anywhere.
            </p>
          </div>
          <ReportUrlForm
            className="flex items-end gap-2"
            inputAriaLabel="Report URL or ID"
            isSubmitting={isSubmitting}
            placeholder="Paste Warcraft Logs report URL or report ID"
            suggestions={searchReports(value, 20)}
            value={value}
            onSelectSuggestion={(suggestion) => {
              setValue('')
              navigate(`/report/${suggestion.reportId}`, {
                state: { host: suggestion.sourceHost },
              })
            }}
            onSubmit={(input) => {
              void openReport(input)
            }}
            onValueChange={setValue}
          />
          {errorMessage ? (
            <Alert aria-live="polite" variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          {recentReports.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Example logs
              </p>
              <ExampleReportList examples={exampleReports} />
            </div>
          ) : null}
        </section>
      </div>
    </>
  )
}
