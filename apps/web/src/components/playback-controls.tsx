/**
 * Transport row for replay mode: play/pause and speed on the left, cursor time and clear on the right.
 */
import { Pause, Play } from 'lucide-react'
import type { FC } from 'react'

import { formatTimelineTime } from '../lib/format'
import { Button } from './ui/button'
import { Kbd } from './ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

export type PlaybackControlsProps = {
  isPlaying: boolean
  isReplayMode: boolean
  playbackSpeed: number
  hasPlayhead: boolean
  playheadMs?: number | null
  onTogglePlayPause: () => void
  onIncreaseSpeed: () => void
  onDecreaseSpeed: () => void
  onToggleReplayMode: () => void
  onClearPlayhead: () => void
}

/** Compact transport row rendered directly under the chart. */
export const PlaybackControls: FC<PlaybackControlsProps> = ({
  isPlaying,
  isReplayMode,
  playbackSpeed,
  hasPlayhead,
  playheadMs = null,
  onTogglePlayPause,
  onIncreaseSpeed,
  onDecreaseSpeed,
  onToggleReplayMode,
  onClearPlayhead,
}) => {
  return (
    <TooltipProvider>
      <div
        aria-label="Playback controls"
        className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-1 text-xs text-card-foreground"
        role="group"
      >
        <div className="flex flex-wrap items-center gap-1">
          {isReplayMode ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                    onClick={onTogglePlayPause}
                  >
                    {isPlaying ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isPlaying ? 'Pause' : 'Play'} <Kbd>Space</Kbd>
                </TooltipContent>
              </Tooltip>

              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                      onClick={onDecreaseSpeed}
                    >
                      <span className="text-[10px] font-medium">&lt;</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Slower <Kbd>&lt;</Kbd>
                  </TooltipContent>
                </Tooltip>

                <span className="min-w-8 text-center text-xs font-medium tabular-nums text-muted-foreground">
                  {playbackSpeed}x
                </span>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                      onClick={onIncreaseSpeed}
                    >
                      <span className="text-[10px] font-medium">&gt;</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Faster <Kbd>&gt;</Kbd>
                  </TooltipContent>
                </Tooltip>
              </div>
            </>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={onToggleReplayMode}
              >
                {isReplayMode
                  ? 'Exit Replay'
                  : hasPlayhead
                    ? 'Resume Replay'
                    : 'Replay'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isReplayMode ? (
                <>
                  Exit replay mode <Kbd>Esc</Kbd>
                </>
              ) : (
                <>
                  {hasPlayhead ? 'Re-enter' : 'Enter'} replay mode{' '}
                  <Kbd>Space</Kbd>
                </>
              )}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="tabular-nums text-muted-foreground"
            data-testid="transport-cursor"
          >
            Cursor{' '}
            {hasPlayhead && playheadMs !== null
              ? formatTimelineTime(playheadMs)
              : '—'}
          </span>
          {hasPlayhead ? (
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClearPlayhead}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  )
}
