/**
 * Render preconfigured example report links.
 */
import { Link } from 'react-router-dom'

import type { ExampleReportLink } from '../types/app'

export function ExampleReportList({
  examples,
}: {
  examples: ExampleReportLink[]
}): JSX.Element {
  return (
    <ul className="space-y-2">
      {examples.map((example) => (
        <li
          className="rounded-md border border-border bg-panel px-3 py-2"
          key={example.reportId}
        >
          <Link
            className="font-medium underline"
            state={{ host: example.host }}
            to={`/report/${example.reportId}`}
          >
            {example.label}
          </Link>
          <p className="mt-1 text-xs text-muted">{example.host}</p>
        </li>
      ))}
    </ul>
  )
}
