/**
 * Render recent reports from local history.
 */
import { Link } from 'react-router-dom'

import type { RecentReportEntry } from '../types/app'

export function RecentReportsList({
  reports,
}: {
  reports: RecentReportEntry[]
}): JSX.Element {
  if (reports.length === 0) {
    return <p className="text-sm text-muted">No recent reports yet.</p>
  }

  return (
    <ul className="space-y-2">
      {reports.map((report) => (
        <li
          className="rounded-md border border-border bg-panel px-3 py-2"
          key={report.reportId}
        >
          <Link
            className="font-medium underline"
            state={{ host: report.sourceHost }}
            to={`/report/${report.reportId}`}
          >
            {report.title || report.reportId}
          </Link>
          <p className="mt-1 text-xs text-muted">
            {report.sourceHost} · {new Date(report.lastOpenedAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  )
}
