/**
 * Bottom drawer for the focused player's summary, with a title bar that stays visible when collapsed.
 * Below 760px it is shown as its own tab, always expanded.
 */
import { Info, Keyboard } from 'lucide-react'
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
import type { FocusedPlayerSummary, InitialAuraDisplay } from '../types/app'
import { PlayerName } from './player-name'
import { Button } from './ui/button'
import { Kbd } from './ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

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
  children: ReactNode
}

/** Inline row of small squares, one per threat-relevant initial aura, each with a name tooltip. */
const CollapsedAuraSquares: FC<{ auras: InitialAuraDisplay[] }> = ({
  auras,
}) => (
  <div
    className="flex min-w-0 flex-1 flex-wrap items-center gap-1 overflow-hidden"
    data-testid="player-info-collapsed-auras"
  >
    {auras
      .filter((aura) => aura.isNotable)
      .map((aura) => {
        const label = `${aura.name}${aura.stacks > 1 ? ` (${aura.stacks})` : ''}`
        return (
          <Tooltip key={aura.spellId}>
            <TooltipTrigger asChild>
              <span
                aria-label={label}
                className="h-3.5 w-3.5 shrink-0 rounded-[3px] border border-yellow-500/60 bg-yellow-500/30"
                role="img"
              />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        )
      })}
  </div>
)

/** Collapsible "Player info" drawer; collapsed, the bar shows the focused player and their initial auras. */
export const PlayerInfoDrawer: FC<PlayerInfoDrawerProps> = ({
  isOpen,
  onToggle,
  bodyHeight = null,
  onBodyHeightChange,
  summary,
  initialAuras,
  children,
}) => {
  const titleId = useId()
  const bodyId = useId()
  const openShortcuts = useOpenShortcuts()
  const isMobile = useIsMobileLayout()
  const isExpanded = isOpen || isMobile
  const toggleLabel = isOpen ? 'Collapse player info' : 'Expand player info'
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
    <TooltipProvider delayDuration={0}>
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
        {/* Whole bar toggles; the chevron-style button inside is the keyboard/AT entry point. */}
        <div
          className="flex h-9 shrink-0 items-center gap-2 px-2 max-[760px]:cursor-default min-[761px]:cursor-pointer"
          data-testid="player-info-bar"
          onClick={isMobile ? undefined : onToggle}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-controls={bodyId}
                className="max-[760px]:hidden"
                aria-expanded={isOpen}
                aria-keyshortcuts="I"
                aria-label={toggleLabel}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Info
                  aria-hidden="true"
                  className={`h-4 w-4 ${isOpen ? 'fill-current stroke-background' : ''}`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {toggleLabel} <Kbd>I</Kbd>
            </TooltipContent>
          </Tooltip>
          <h2 className="text-xs font-medium" id={titleId}>
            Player info
          </h2>
          {!isExpanded && summary ? (
            <>
              <PlayerName color={summary.color} label={summary.label} />
              <CollapsedAuraSquares auras={initialAuras} />
            </>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Show keyboard shortcuts"
                className="ml-auto max-[760px]:hidden"
                size="icon"
                type="button"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation()
                  openShortcuts()
                }}
              >
                <Keyboard aria-hidden="true" className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Keyboard shortcuts <Kbd>?</Kbd>
            </TooltipContent>
          </Tooltip>
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
    </TooltipProvider>
  )
}
