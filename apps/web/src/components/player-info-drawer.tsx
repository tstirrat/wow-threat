/**
 * Bottom drawer for the focused player's summary, with a title bar that stays visible when collapsed.
 * Below 760px it is shown as its own tab, always expanded.
 */
import { ChevronDown, ChevronUp, Keyboard } from 'lucide-react'
import {
  type FC,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from 'react'

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

const MIN_BODY_HEIGHT = 96
const MAX_BODY_VIEWPORT_RATIO = 0.8
const KEYBOARD_STEP = 24

/** Default body height: one third of the viewport. */
const defaultBodyHeight = (): number => Math.round(window.innerHeight / 3)

const clampBodyHeight = (height: number): number =>
  Math.round(
    Math.max(
      MIN_BODY_HEIGHT,
      Math.min(height, window.innerHeight * MAX_BODY_VIEWPORT_RATIO),
    ),
  )

export type PlayerInfoDrawerProps = {
  isOpen: boolean
  onToggle: () => void
  /** Saved body height in px; null falls back to one third of the viewport. */
  bodyHeight?: number | null
  onBodyHeightChange?: (height: number) => void
  summary: FocusedPlayerSummary | null
  initialAuras: InitialAuraDisplay[]
  wowhead: WowheadLinksConfig
  children: ReactNode
}

/** Collapsible "Player info" drawer; collapsed, the bar shows the focused player and their initial auras. */
export const PlayerInfoDrawer: FC<PlayerInfoDrawerProps> = ({
  isOpen,
  onToggle,
  bodyHeight = null,
  onBodyHeightChange,
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
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const dragStart = useRef<{ y: number; height: number } | null>(null)
  const currentHeight = clampBodyHeight(
    dragHeight ?? bodyHeight ?? defaultBodyHeight(),
  )

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = { y: event.clientY, height: currentHeight }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!dragStart.current) {
      return
    }
    setDragHeight(
      clampBodyHeight(
        dragStart.current.height + (dragStart.current.y - event.clientY),
      ),
    )
  }

  const endDrag = (): void => {
    if (dragStart.current && dragHeight !== null) {
      onBodyHeightChange?.(dragHeight)
    }
    dragStart.current = null
    setDragHeight(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const delta =
      event.key === 'ArrowUp'
        ? KEYBOARD_STEP
        : event.key === 'ArrowDown'
          ? -KEYBOARD_STEP
          : 0
    if (delta === 0) {
      return
    }
    event.preventDefault()
    onBodyHeightChange?.(clampBodyHeight(currentHeight + delta))
  }

  return (
    <section
      aria-labelledby={titleId}
      className="relative flex min-h-0 flex-col text-card-foreground max-[760px]:flex-1"
    >
      {isOpen && !isMobile ? (
        <div
          aria-controls={bodyId}
          aria-label="Resize player info"
          aria-orientation="horizontal"
          aria-valuemax={Math.round(
            window.innerHeight * MAX_BODY_VIEWPORT_RATIO,
          )}
          aria-valuemin={MIN_BODY_HEIGHT}
          aria-valuenow={currentHeight}
          className="absolute -top-1 right-0 left-0 z-10 h-2 cursor-row-resize touch-none hover:bg-primary/40 focus-visible:bg-primary/40 focus-visible:outline-none"
          role="separator"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onPointerCancel={endDrag}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
        />
      ) : null}
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
      <div
        aria-hidden={!isExpanded}
        className={`min-h-0 overflow-hidden max-[760px]:flex-1 ${
          dragHeight === null
            ? 'transition-[height,visibility] duration-200 motion-reduce:transition-none'
            : ''
        } ${isExpanded ? 'border-t border-border' : 'invisible'}`}
        id={bodyId}
        inert={!isExpanded}
        style={isMobile ? undefined : { height: isOpen ? currentHeight : 0 }}
      >
        <div className="h-full overflow-y-auto">{children}</div>
      </div>
    </section>
  )
}
