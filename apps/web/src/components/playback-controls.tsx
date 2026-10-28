/**
 * Playback controls for replay mode: play/pause, speed, and mode toggle.
 */
import { Pause, Play, X } from 'lucide-react'
import type { FC } from 'react'

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
  onTogglePlayPause: () => void
  onIncreaseSpeed: () => void
  onDecreaseSpeed: () => void
  onToggleReplayMode: () => void
  onClearPlayhead: () => void
}

/** Inline playback controls rendered alongside chart controls. */
export const PlaybackControls: FC<PlaybackControlsProps> = ({
  isPlaying,
  isReplayMode,
  playbackSpeed,
  hasPlayhead,
  onTogglePlayPause,
  onIncreaseSpeed,
  onDecreaseSpeed,
  onToggleReplayMode,
  onClearPlayhead,
}) => {
  if (!isReplayMode && !hasPlayhead) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={onToggleReplayMode}
            >
              Replay
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Enter replay mode <Kbd>R</Kbd>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (!isReplayMode && hasPlayhead) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={onToggleReplayMode}
              >
                Resume Replay
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Re-enter replay mode <Kbd>R</Kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                type="button"
                variant="ghost"
                onClick={onClearPlayhead}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear playhead</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={onToggleReplayMode}
            >
              Exit Replay
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Exit replay mode <Kbd>R</Kbd> or <Kbd>Esc</Kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={onClearPlayhead}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear playhead</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
