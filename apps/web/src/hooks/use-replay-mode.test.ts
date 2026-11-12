/**
 * Unit tests for the playhead/playback hook.
 */
import { act, renderHook } from '@testing-library/react'
import type { PostHog } from 'posthog-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useReplayMode } from './use-replay-mode'

function createMockPosthog(): PostHog {
  return { capture: vi.fn() } as unknown as PostHog
}

function createProps(
  overrides: Partial<Parameters<typeof useReplayMode>[0]> = {},
): Parameters<typeof useReplayMode>[0] {
  return {
    committedPlayheadMs: null,
    onCommitState: vi.fn(),
    maxMs: 60000,
    ...overrides,
  }
}

describe('useReplayMode', () => {
  let frameTime = 0
  let pendingFrame: FrameRequestCallback | null = null

  beforeEach(() => {
    frameTime = 0
    pendingFrame = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      pendingFrame = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      pendingFrame = null
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Advance the mocked animation clock by `deltaMs` of wall time. */
  function advance(deltaMs: number): void {
    const callback = pendingFrame
    pendingFrame = null
    frameTime += deltaMs
    callback?.(frameTime)
  }

  describe('initial state', () => {
    it('has no playhead and is paused', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      expect(result.current.effectivePlayheadMs).toBeNull()
      expect(result.current.isPlaying).toBe(false)
      expect(result.current.playbackSpeed).toBe(1)
    })

    it('adopts the committed playhead', () => {
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedPlayheadMs: 5000 })),
      )

      expect(result.current.effectivePlayheadMs).toBe(5000)
    })
  })

  describe('togglePlayPause', () => {
    it('plays from the start when no playhead exists', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      act(() => {
        result.current.togglePlayPause()
      })

      expect(result.current.isPlaying).toBe(true)
      expect(result.current.effectivePlayheadMs).toBe(0)
    })

    it('plays from the existing playhead', () => {
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedPlayheadMs: 12000 })),
      )

      act(() => {
        result.current.togglePlayPause()
      })

      expect(result.current.isPlaying).toBe(true)
      expect(result.current.effectivePlayheadMs).toBe(12000)
    })

    it('pauses and commits the playhead when already playing', () => {
      const onCommitState = vi.fn()
      const { result } = renderHook(() =>
        useReplayMode(createProps({ onCommitState })),
      )

      act(() => {
        result.current.togglePlayPause()
      })
      act(() => {
        advance(0)
        advance(2000)
      })
      act(() => {
        result.current.togglePlayPause()
      })

      expect(result.current.isPlaying).toBe(false)
      expect(onCommitState).toHaveBeenLastCalledWith({ playheadMs: 2000 })
    })

    it('stops at the right edge of the window', () => {
      const onCommitState = vi.fn()
      const { result } = renderHook(() =>
        useReplayMode(
          createProps({
            onCommitState,
            committedPlayheadMs: 1000,
            playbackEndMs: 3000,
          }),
        ),
      )

      act(() => {
        result.current.togglePlayPause()
      })
      act(() => {
        advance(0)
        advance(10000)
      })

      expect(result.current.isPlaying).toBe(false)
      expect(result.current.effectivePlayheadMs).toBe(3000)
      expect(onCommitState).toHaveBeenLastCalledWith({ playheadMs: 3000 })
    })

    it('restarts from the window start when played from the right edge', () => {
      const { result } = renderHook(() =>
        useReplayMode(
          createProps({
            committedPlayheadMs: 3000,
            playbackStartMs: 500,
            playbackEndMs: 3000,
          }),
        ),
      )

      act(() => {
        result.current.togglePlayPause()
      })

      expect(result.current.isPlaying).toBe(true)
      expect(result.current.effectivePlayheadMs).toBe(500)
    })
  })

  describe('clearPlayhead', () => {
    it('clears the playhead, stops playback, and commits null', () => {
      const onCommitState = vi.fn()
      const { result } = renderHook(() =>
        useReplayMode(createProps({ onCommitState })),
      )

      act(() => {
        result.current.togglePlayPause()
      })
      act(() => {
        result.current.clearPlayhead()
      })

      expect(result.current.isPlaying).toBe(false)
      expect(result.current.effectivePlayheadMs).toBeNull()
      expect(onCommitState).toHaveBeenLastCalledWith({ playheadMs: null })
    })
  })

  describe('setPlayheadMs', () => {
    it('commits the new playhead', () => {
      const onCommitState = vi.fn()
      const { result } = renderHook(() =>
        useReplayMode(createProps({ onCommitState })),
      )

      act(() => {
        result.current.setPlayheadMs(4200)
      })

      expect(result.current.effectivePlayheadMs).toBe(4200)
      expect(onCommitState).toHaveBeenLastCalledWith({ playheadMs: 4200 })
    })
  })

  describe('posthog tracking', () => {
    it('captures playback_started when playback begins', () => {
      const posthog = createMockPosthog()
      const { result } = renderHook(() =>
        useReplayMode(createProps({ posthog })),
      )

      act(() => {
        result.current.togglePlayPause()
      })

      expect(posthog.capture).toHaveBeenCalledWith('playback_started')
    })
  })

  describe('setPlayheadMs', () => {
    it('clamps to valid range', () => {
      const { result } = renderHook(() =>
        useReplayMode(createProps({ maxMs: 10000 })),
      )

      act(() => {
        result.current.setPlayheadMs(50000)
      })

      expect(result.current.effectivePlayheadMs).toBe(10000)

      act(() => {
        result.current.setPlayheadMs(-100)
      })

      expect(result.current.effectivePlayheadMs).toBe(0)
    })
  })

  describe('speed controls', () => {
    it('increases speed through tiers', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      expect(result.current.playbackSpeed).toBe(1)

      act(() => {
        result.current.increaseSpeed()
      })
      expect(result.current.playbackSpeed).toBe(1.5)

      act(() => {
        result.current.increaseSpeed()
      })
      expect(result.current.playbackSpeed).toBe(2)
    })

    it('decreases speed through tiers', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      act(() => {
        result.current.decreaseSpeed()
      })
      expect(result.current.playbackSpeed).toBe(0.5)

      act(() => {
        result.current.decreaseSpeed()
      })
      expect(result.current.playbackSpeed).toBe(0.25)
    })

    it('clamps at min and max speed', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      act(() => {
        result.current.increaseSpeed()
        result.current.increaseSpeed()
        result.current.increaseSpeed()
        result.current.increaseSpeed()
      })
      expect(result.current.playbackSpeed).toBe(2)

      act(() => {
        result.current.decreaseSpeed()
        result.current.decreaseSpeed()
        result.current.decreaseSpeed()
        result.current.decreaseSpeed()
        result.current.decreaseSpeed()
        result.current.decreaseSpeed()
      })
      expect(result.current.playbackSpeed).toBe(0.25)
    })
  })

  describe('stepping', () => {
    it('steps forward by 1 second', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      act(() => {
        result.current.setPlayheadMs(5000)
      })

      act(() => {
        result.current.stepForward()
      })

      expect(result.current.effectivePlayheadMs).toBe(6000)
    })

    it('steps forward by 100ms with fineStep', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      act(() => {
        result.current.setPlayheadMs(5000)
      })

      act(() => {
        result.current.stepForward(true)
      })

      expect(result.current.effectivePlayheadMs).toBe(5100)
    })

    it('steps backward by 1 second', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      act(() => {
        result.current.setPlayheadMs(5000)
      })

      act(() => {
        result.current.stepBackward()
      })

      expect(result.current.effectivePlayheadMs).toBe(4000)
    })

    it('steps backward by 100ms with fineStep', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      act(() => {
        result.current.setPlayheadMs(5000)
      })

      act(() => {
        result.current.stepBackward(true)
      })

      expect(result.current.effectivePlayheadMs).toBe(4900)
    })

    it('clamps step forward at maxMs', () => {
      const { result } = renderHook(() =>
        useReplayMode(createProps({ maxMs: 5500 })),
      )

      act(() => {
        result.current.setPlayheadMs(5000)
      })

      act(() => {
        result.current.stepForward()
      })

      expect(result.current.effectivePlayheadMs).toBe(5500)
    })

    it('clamps step backward at 0', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      act(() => {
        result.current.setPlayheadMs(500)
      })

      act(() => {
        result.current.stepBackward()
      })

      expect(result.current.effectivePlayheadMs).toBe(0)
    })
  })
})
