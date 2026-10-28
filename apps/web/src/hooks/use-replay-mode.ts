/**
 * Central hook for replay mode state, playback animation, and playhead management.
 */
import type { PostHog } from 'posthog-js'
import { useCallback, useEffect, useRef, useState } from 'react'

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2] as const
const DEFAULT_SPEED_INDEX = 2 // 1x

export interface UseReplayModeResult {
  isReplayMode: boolean
  effectivePlayheadMs: number | null
  isPlaying: boolean
  playbackSpeed: number
  enterReplayMode: () => void
  exitReplayMode: () => void
  toggleReplayMode: () => void
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

/** Manage replay mode lifecycle, playhead position, and playback animation. */
export function useReplayMode({
  committedPlayheadMs,
  committedReplay,
  onCommitState,
  resetZoom,
  maxMs,
  posthog,
}: {
  committedPlayheadMs: number | null
  committedReplay: boolean
  onCommitState: (state: {
    playheadMs?: number | null
    replay?: boolean
  }) => void
  resetZoom: () => void
  maxMs: number
  posthog?: PostHog
}): UseReplayModeResult {
  const [isReplayMode, setIsReplayMode] = useState(committedReplay)
  const [localPlayheadMs, setLocalPlayheadMs] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX)

  const rafRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  const playheadRef = useRef<number>(0)
  const speedRef = useRef<number>(PLAYBACK_SPEEDS[DEFAULT_SPEED_INDEX]!)
  const maxMsRef = useRef(maxMs)

  useEffect(() => {
    maxMsRef.current = maxMs
  }, [maxMs])

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

  const enterReplayMode = useCallback((): void => {
    posthog?.capture('replay_mode_entered')
    resetZoom()
    setIsReplayMode(true)
    onCommitState({ replay: true })
    const startMs = committedPlayheadMs ?? 0
    setLocalPlayheadMs(startMs)
    playheadRef.current = startMs
  }, [committedPlayheadMs, onCommitState, posthog, resetZoom])

  const exitReplayMode = useCallback((): void => {
    posthog?.capture('replay_mode_exited')
    stopAnimation()
    setIsPlaying(false)
    setIsReplayMode(false)
    onCommitState({
      replay: false,
      playheadMs: localPlayheadMs,
    })
    setLocalPlayheadMs(null)
  }, [localPlayheadMs, onCommitState, posthog, stopAnimation])

  const toggleReplayMode = useCallback((): void => {
    if (isReplayMode) {
      exitReplayMode()
    } else {
      enterReplayMode()
    }
  }, [enterReplayMode, exitReplayMode, isReplayMode])

  const clearPlayhead = useCallback((): void => {
    stopAnimation()
    setIsPlaying(false)
    setIsReplayMode(false)
    setLocalPlayheadMs(null)
    onCommitState({ replay: false, playheadMs: null })
  }, [onCommitState, stopAnimation])

  const setPlayheadMs = useCallback((ms: number): void => {
    const clamped = Math.max(0, Math.min(ms, maxMsRef.current))
    setLocalPlayheadMs(clamped)
    playheadRef.current = clamped
  }, [])

  const startPlayback = useCallback(
    (fromMs: number): void => {
      const startMs = fromMs
      if (startMs >= maxMs) {
        playheadRef.current = 0
        setLocalPlayheadMs(0)
      } else {
        playheadRef.current = startMs
      }

      setIsPlaying(true)
      lastFrameTimeRef.current = null

      const tick = (frameTime: number): void => {
        if (lastFrameTimeRef.current === null) {
          lastFrameTimeRef.current = frameTime
          rafRef.current = requestAnimationFrame(tick)
          return
        }

        const deltaMs =
          (frameTime - lastFrameTimeRef.current) * speedRef.current
        lastFrameTimeRef.current = frameTime

        const nextMs = Math.min(playheadRef.current + deltaMs, maxMsRef.current)
        playheadRef.current = nextMs
        setLocalPlayheadMs(nextMs)

        if (nextMs >= maxMsRef.current) {
          setIsPlaying(false)
          lastFrameTimeRef.current = null
          rafRef.current = null
          return
        }

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    },
    [maxMs],
  )

  const play = useCallback((): void => {
    if (!isReplayMode) {
      return
    }

    startPlayback(effectivePlayheadMs ?? 0)
  }, [effectivePlayheadMs, isReplayMode, startPlayback])

  const pause = useCallback((): void => {
    stopAnimation()
    setIsPlaying(false)
    if (localPlayheadMs !== null) {
      onCommitState({ playheadMs: localPlayheadMs })
    }
  }, [localPlayheadMs, onCommitState, stopAnimation])

  const togglePlayPause = useCallback((): void => {
    if (!isReplayMode) {
      enterReplayMode()
      startPlayback(committedPlayheadMs ?? 0)
      return
    }

    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [
    committedPlayheadMs,
    enterReplayMode,
    isPlaying,
    isReplayMode,
    pause,
    play,
    startPlayback,
  ])

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
      const current = effectivePlayheadMs ?? 0
      const next = Math.min(current + stepMs, maxMs)
      setLocalPlayheadMs(next)
      playheadRef.current = next
    },
    [effectivePlayheadMs, maxMs],
  )

  const stepBackward = useCallback(
    (fineStep = false): void => {
      const stepMs = fineStep ? 100 : 1000
      const current = effectivePlayheadMs ?? 0
      const next = Math.max(current - stepMs, 0)
      setLocalPlayheadMs(next)
      playheadRef.current = next
    },
    [effectivePlayheadMs],
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
    isReplayMode,
    effectivePlayheadMs,
    isPlaying,
    playbackSpeed,
    enterReplayMode,
    exitReplayMode,
    toggleReplayMode,
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
