/**
 * Two-line report row shared by every library rail list.
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import { formatReportListDate } from '../lib/format'
import {
  normalizeGuildFaction,
  resolveTitleRowClass,
} from '../lib/guild-faction'
import { cn } from '../lib/utils'
import type { WarcraftLogsHost } from '../types/app'
import { ReportStarButton } from './report-star-button'
import { Badge } from './ui/badge'

export interface ReportRowProps {
  reportId: string
  title: string
  sourceHost: WarcraftLogsHost
  zoneName?: string | null
  /** Report start time in Unix milliseconds. */
  startTime?: number | null
  guildName?: string | null
  guildFaction?: string | null
  isStarred?: boolean
  /** Omit to hide the star toggle. */
  onToggleStar?: () => void
  /** Omit to hide the remove control. */
  onRemove?: () => void
  /** Render the title as plain text instead of a link. */
  isDisabled?: boolean
  /** Status badge shown under the subtitle, e.g. archived. */
  statusLabel?: string
  onOpen?: () => void
}

/** Render a title row (name, star) above a zone and date row. */
export const ReportRow: FC<ReportRowProps> = ({
  reportId,
  title,
  sourceHost,
  zoneName,
  startTime,
  guildName,
  guildFaction,
  isStarred = false,
  onToggleStar,
  onRemove,
  isDisabled = false,
  statusLabel,
  onOpen,
}) => {
  const name = title || reportId
  const guildClass = resolveTitleRowClass(normalizeGuildFaction(guildFaction))
  const label = (
    <>
      {name}
      {guildName ? (
        <>
          {' '}
          <span className={cn('font-normal', guildClass)}>
            {`<${guildName}>`}
          </span>
        </>
      ) : null}
    </>
  )
  const subtitle = [
    zoneName ?? 'Unknown zone',
    typeof startTime === 'number' ? formatReportListDate(startTime) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="group rounded-md px-2 py-1 transition-colors hover:bg-muted focus-within:bg-muted">
      <div className="flex items-center gap-1.5">
        {isDisabled ? (
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
            {label}
          </span>
        ) : (
          <Link
            className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline"
            state={{ host: sourceHost }}
            to={`/report/${reportId}`}
            onClick={onOpen}
          >
            {label}
          </Link>
        )}
        {onToggleStar ? (
          <ReportStarButton
            ariaLabel={`${isStarred ? 'Unstar' : 'Star'} report ${name}`}
            className={cn(
              'shrink-0',
              !isStarred &&
                'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100',
            )}
            isDisabled={isDisabled}
            isStarred={isStarred}
            size="icon-xs"
            onToggle={onToggleStar}
          />
        ) : null}
        {onRemove ? (
          <button
            aria-label={`Remove recent report ${name}`}
            className="shrink-0 cursor-pointer text-xs leading-none text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
            type="button"
            onClick={onRemove}
          >
            ✕
          </button>
        ) : null}
      </div>
      <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      {statusLabel ? (
        <Badge className="mt-1" variant="secondary">
          {statusLabel}
        </Badge>
      ) : null}
    </li>
  )
}
