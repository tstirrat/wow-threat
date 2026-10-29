/**
 * Bottom drawer for the focused player's summary, with a title bar that stays visible when collapsed.
 * Below 760px it is shown as its own tab, always expanded.
 */
import { ChevronDown, ChevronUp, Keyboard } from 'lucide-react'
import { type FC, type ReactNode, useId } from 'react'

import { useIsMobileLayout } from '../hooks/use-is-mobile-layout'
import { useOpenShortcuts } from '../routes/app-shell-context'
import type {
  FocusedPlayerSummary,
  InitialAuraDisplay,
  WowheadLinksConfig,
} from '../types/app'
import { InitialAuras } from './initial-auras'
import { PlayerName } from './player-name'
import { Button } from './ui/button'

export type PlayerInfoDrawerProps = {
  isOpen: boolean
  onToggle: () => void
  summary: FocusedPlayerSummary | null
  initialAuras: InitialAuraDisplay[]
  wowhead: WowheadLinksConfig
  children: ReactNode
}

/** Collapsible "Player info" drawer; collapsed, the bar shows the focused player and their initial auras. */
export const PlayerInfoDrawer: FC<PlayerInfoDrawerProps> = ({
  isOpen,
  onToggle,
  summary,
  initialAuras,
  wowhead,
  children,
}) => {
  const titleId = useId()
  const bodyId = useId()
  const openShortcuts = useOpenShortcuts()
  const isMobile = useIsMobileLayout()
  const isExpanded = isOpen || isMobile
  const toggleLabel = isOpen ? 'Collapse player info' : 'Expand player info'
  const ChevronIcon = isOpen ? ChevronDown : ChevronUp

  return (
    <section
      aria-labelledby={titleId}
      className="flex min-h-0 flex-col text-card-foreground max-[760px]:flex-1"
    >
      <div className="flex h-9 shrink-0 items-center gap-2 px-2">
        <Button
          aria-controls={bodyId}
          className="max-[760px]:hidden"
          aria-expanded={isOpen}
          aria-keyshortcuts="I"
          aria-label={toggleLabel}
          size="icon"
          title={`${toggleLabel} (I)`}
          type="button"
          variant="ghost"
          onClick={onToggle}
        >
          <ChevronIcon aria-hidden="true" className="h-4 w-4" />
        </Button>
        <h2 className="text-xs font-medium" id={titleId}>
          Player info
        </h2>
        {!isExpanded && summary ? (
          <>
            <PlayerName color={summary.color} label={summary.label} />
            <div
              className="max-h-6 min-w-0 flex-1 overflow-hidden"
              data-testid="player-info-collapsed-auras"
            >
              <InitialAuras auras={initialAuras} wowhead={wowhead} />
            </div>
          </>
        ) : null}
        <Button
          aria-label="Show keyboard shortcuts"
          className="ml-auto max-[760px]:hidden"
          size="icon"
          title="Keyboard shortcuts (?)"
          type="button"
          variant="ghost"
          onClick={openShortcuts}
        >
          <Keyboard aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
      {isExpanded ? (
        <div
          className="max-h-[40vh] min-h-0 overflow-y-auto border-t border-border max-[760px]:max-h-none max-[760px]:flex-1"
          id={bodyId}
        >
          {children}
        </div>
      ) : null}
    </section>
  )
}
