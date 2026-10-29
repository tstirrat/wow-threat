/**
 * Target crumb for the app bar title (last crumb) and the Warcraft Logs fight icon link.
 */
import { ExternalLink } from 'lucide-react'
import type { FC } from 'react'

import type { FightTarget, FightTargetOption } from '../types/app'
import { TargetSelector } from './target-selector'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export type FightBarTargetProps = {
  targets: FightTargetOption[]
  selectedTarget: FightTarget | null
  onTargetChange: (target: FightTarget) => void
}

export const FightBarTarget: FC<FightBarTargetProps> = ({
  targets,
  selectedTarget,
  onTargetChange,
}) =>
  selectedTarget ? (
    <TargetSelector
      targets={targets}
      selectedTarget={selectedTarget}
      onChange={onTargetChange}
    />
  ) : (
    <span className="truncate text-sm text-muted-foreground">
      No valid targets available.
    </span>
  )

export type FightBarWarcraftLogsLinkProps = {
  fightName: string
  warcraftLogsUrl: string
}

/** Ghost icon button linking to the fight on Warcraft Logs. */
export const FightBarWarcraftLogsLink: FC<FightBarWarcraftLogsLinkProps> = ({
  fightName,
  warcraftLogsUrl,
}) => {
  const label = `Open ${fightName} on Warcraft Logs`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild size="icon" variant="ghost">
          <a
            aria-label={label}
            href={warcraftLogsUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" withArrow>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
