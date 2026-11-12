/**
 * Central hook for the chart playhead (T), playback animation, and stepping.
 */
import type { PostHog } from 'posthog-js'
import { useCallback, useEffect, useRef, useState } from 'react'

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2] as const
const DEFAULT_SPEED_INDEX = 2 // 1x

export interface UseReplayModeResult {
  effectivePlayheadMs: number | null
  isPlaying: boolean
  playbackSpeed: number
  clearPlayhead: () => void
  setPlayheadMs: (ms: number) => void
  play: () => void
  pause: () => void
  togglePlayPause: () => void
  increaseSpeed: () => void
  decreaseSpeed: () => void
  stepForward: (fineStep?: boolean) => void
  stepBackward: (fineStep?: boolean) => void
}

/** Manage the playhead position and playback animation. */
export function useReplayMode({
  committedPlayheadMs,
  onCommitState,
  maxMs,
  playbackStartMs = 0,
  playbackEndMs,
  posthog,
}: {
  committedPlayheadMs: number | null
  onCommitState: (state: { playheadMs?: number | null }) => void
  /** Fight duration; the playhead never leaves [0, maxMs]. */
  maxMs: number
  /** Left edge of the visible window; playback restarts here from the end. */
  playbackStartMs?: number
  /** Right edge of the visible window; playback pauses here. Defaults to maxMs. */
  playbackEndMs?: number
  posthog?: PostHog
}): UseReplayModeResult {
  const [localPlayheadMs, setLocalPlayheadMs] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX)

  const rafRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  const playheadRef = useRef<number>(0)
  const speedRef = useRef<number>(PLAYBACK_SPEEDS[DEFAULT_SPEED_INDEX]!)
  const maxMsRef = useRef(maxMs)
  const endMs = Math.min(playbackEndMs ?? maxMs, maxMs)
  const endMsRef = useRef(endMs)
  const onCommitStateRef = useRef(onCommitState)

  useEffect(() => {
    maxMsRef.current = maxMs
    endMsRef.current = endMs
    onCommitStateRef.current = onCommitState
  }, [endMs, maxMs, onCommitState])

  const playbackSpeed = PLAYBACK_SPEEDS[speedIndex]!

  useEffect(() => {
    speedRef.current = playbackSpeed
  }, [playbackSpeed])

  const effectivePlayheadMs = localPlayheadMs ?? committedPlayheadMs

  const stopAnimation = useCallback((): void => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    lastFrameTimeRef.current = null
  }, [])

  const clearPlayhead = useCallback((): void => {
    stopAnimation()
    setIsPlaying(false)
    setLocalPlayheadMs(null)
    onCommitState({ playheadMs: null })
  }, [onCommitState, stopAnimation])

  const setPlayheadMs = useCallback(
    (ms: number): void => {
      const clamped = Math.max(0, Math.min(ms, maxMsRef.current))
      setLocalPlayheadMs(clamped)
      playheadRef.current = clamped
      onCommitState({ playheadMs: clamped })
    },
    [onCommitState],
  )

  const startPlayback = useCallback((fromMs: number): void => {
    playheadRef.current = fromMs
    setLocalPlayheadMs(playheadRef.current)
    setIsPlaying(true)
    lastFrameTimeRef.current = null

    const tick = (frameTime: number): void => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = frameTime
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const deltaMs = (frameTime - lastFrameTimeRef.current) * speedRef.current
      lastFrameTimeRef.current = frameTime

      const nextMs = Math.min(playheadRef.current + deltaMs, endMsRef.current)
      playheadRef.current = nextMs
      setLocalPlayheadMs(nextMs)

      if (nextMs >= endMsRef.current) {
        setIsPlaying(false)
        lastFrameTimeRef.current = null
        rafRef.current = null
        onCommitStateRef.current({ playheadMs: nextMs })
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const play = useCallback((): void => {
    posthog?.capture('playback_started')
    const current = effectivePlayheadMs ?? 0
    // A playhead sitting at the right edge replays from the window start.
    startPlayback(current >= endMs ? playbackStartMs : current)
  }, [effectivePlayheadMs, endMs, playbackStartMs, posthog, startPlayback])

  const pause = useCallback((): void => {
    stopAnimation()
    setIsPlaying(false)
    onCommitState({ playheadMs: playheadRef.current })
  }, [onCommitState, stopAnimation])

  const togglePlayPause = useCallback((): void => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, pause, play])

  const increaseSpeed = useCallback((): void => {
    setSpeedIndex((current) =>
      Math.min(current + 1, PLAYBACK_SPEEDS.length - 1),
    )
  }, [])

  const decreaseSpeed = useCallback((): void => {
    setSpeedIndex((current) => Math.max(current - 1, 0))
  }, [])

  const stepForward = useCallback(
    (fineStep = false): void => {
      const stepMs = fineStep ? 100 : 1000
      setPlayheadMs((effectivePlayheadMs ?? 0) + stepMs)
    },
    [effectivePlayheadMs, setPlayheadMs],
  )

  const stepBackward = useCallback(
    (fineStep = false): void => {
      const stepMs = fineStep ? 100 : 1000
      setPlayheadMs((effectivePlayheadMs ?? 0) - stepMs)
    },
    [effectivePlayheadMs, setPlayheadMs],
  )

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return {
    effectivePlayheadMs,
    isPlaying,
    playbackSpeed,
    clearPlayhead,
    setPlayheadMs,
    play,
    pause,
    togglePlayPause,
    increaseSpeed,
    decreaseSpeed,
    stepForward,
    stepBackward,
  }
}
