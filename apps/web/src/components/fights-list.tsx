/**
 * Fight navigation list for report-level route.
 */
import { Link } from 'react-router-dom'

import type { ReportFightSummary } from '../types/api'

export function FightsList({
  reportId,
  fights,
}: {
  reportId: string
  fights: ReportFightSummary[]
}): JSX.Element {
  return (
    <ul className="space-y-2">
      {fights.map((fight) => (
        <li
          className="rounded-md border border-border bg-panel px-3 py-3"
          key={fight.id}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              className="font-medium underline"
              to={`/report/${reportId}/fight/${fight.id}`}
            >
              {fight.name}
            </Link>
            <span className="text-xs text-muted">Fight #{fight.id}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {fight.kill ? 'Kill' : 'Wipe'} · Duration{' '}
            {Math.round((fight.endTime - fight.startTime) / 1000)}s
          </p>
        </li>
      ))}
    </ul>
  )
}
