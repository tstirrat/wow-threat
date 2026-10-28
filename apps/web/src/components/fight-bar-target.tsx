/**
 * Fight crumb for the app bar title: target picker plus the Warcraft Logs fight link.
 */
import { ExternalLink } from 'lucide-react'
import type { FC } from 'react'

import type { FightTarget, FightTargetOption } from '../types/app'
import { TargetSelector } from './target-selector'

export type FightBarTargetProps = {
  fightName: string
  warcraftLogsUrl: string
  targets: FightTargetOption[]
  selectedTarget: FightTarget | null
  onTargetChange: (target: FightTarget) => void
}

export const FightBarTarget: FC<FightBarTargetProps> = ({
  fightName,
  warcraftLogsUrl,
  targets,
  selectedTarget,
  onTargetChange,
}) => {
  return (
    <div className="flex items-center gap-3">
      {selectedTarget ? (
        <TargetSelector
          targets={targets}
          selectedTarget={selectedTarget}
          onChange={onTargetChange}
        />
      ) : (
        <span className="text-sm text-muted-foreground">
          No valid targets available.
        </span>
      )}
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
