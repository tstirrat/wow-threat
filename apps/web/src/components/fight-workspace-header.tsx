/**
 * Fight workspace header: fight title, duration, WCL link and target picker slot.
 */
import { ExternalLink } from 'lucide-react'
import type { FC, ReactNode } from 'react'

import { formatClockDuration } from '../lib/format'

export type FightTitleProps = {
  fightName: string
  durationMs: number
  warcraftLogsUrl: string
}

/** Fight name, clock duration and a Warcraft Logs link, rendered inline. */
export const FightTitle: FC<FightTitleProps> = ({
  fightName,
  durationMs,
  warcraftLogsUrl,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>{fightName}</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">
        {formatClockDuration(durationMs)}
      </span>
      <span className="text-muted-foreground">|</span>
      <a
        aria-label={`Open ${fightName} on Warcraft Logs`}
        className="inline-flex items-center gap-1 leading-none hover:opacity-80"
        href={warcraftLogsUrl}
        rel="noreferrer"
        target="_blank"
        title={`Open ${fightName} on Warcraft Logs`}
      >
        <span className="text-[10px] font-medium tracking-wide">WCL</span>
        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}

export type FightWorkspaceHeaderProps = {
  title: ReactNode
  actions?: ReactNode
}

/** Small header row above the chart; moves into the app bar title slot later. */
export const FightWorkspaceHeader: FC<FightWorkspaceHeaderProps> = ({
  title,
  actions,
}) => {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="min-w-0 text-base font-medium leading-snug">{title}</h2>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}
