/**
 * Unit tests for the replay mode hook.
 */
import { act, renderHook } from '@testing-library/react'
import type { PostHog } from 'posthog-js'
import { describe, expect, it, vi } from 'vitest'

import { useReplayMode } from './use-replay-mode'

function createMockPosthog(): PostHog {
  return { capture: vi.fn() } as unknown as PostHog
}

function createProps(
  overrides: Partial<Parameters<typeof useReplayMode>[0]> = {},
): Parameters<typeof useReplayMode>[0] {
  return {
    committedPlayheadMs: null,
    committedReplay: false,
    onCommitState: vi.fn(),
    resetZoom: vi.fn(),
    maxMs: 60000,
    ...overrides,
  }
}

describe('useReplayMode', () => {
  describe('initial state', () => {
    it('starts inactive when committedReplay is false', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      expect(result.current.isReplayMode).toBe(false)
      expect(result.current.effectivePlayheadMs).toBeNull()
      expect(result.current.isPlaying).toBe(false)
      expect(result.current.playbackSpeed).toBe(1)
    })

    it('starts active when committedReplay is true', () => {
      const { result } = renderHook(() =>
        useReplayMode(
          createProps({ committedReplay: true, committedPlayheadMs: 5000 }),
        ),
      )

      expect(result.current.isReplayMode).toBe(true)
      expect(result.current.effectivePlayheadMs).toBe(5000)
    })
  })

  describe('enterReplayMode', () => {
    it('enters replay mode and resets zoom', () => {
      const resetZoom = vi.fn()
      const onCommitState = vi.fn()
      const { result } = renderHook(() =>
        useReplayMode(createProps({ resetZoom, onCommitState })),
      )

      act(() => {
        result.current.enterReplayMode()
      })

      expect(result.current.isReplayMode).toBe(true)
      expect(result.current.effectivePlayheadMs).toBe(0)
      expect(resetZoom).toHaveBeenCalled()
      expect(onCommitState).toHaveBeenCalledWith({ replay: true })
    })

    it('resumes from committed playhead position', () => {
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedPlayheadMs: 15000 })),
      )

      act(() => {
        result.current.enterReplayMode()
      })

      expect(result.current.effectivePlayheadMs).toBe(15000)
    })
  })

  describe('exitReplayMode', () => {
    it('exits replay mode and commits playhead and replay state', () => {
      const onCommitState = vi.fn()
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true, onCommitState })),
      )

      act(() => {
        result.current.setPlayheadMs(8000)
      })

      act(() => {
        result.current.exitReplayMode()
      })

      expect(result.current.isReplayMode).toBe(false)
      expect(onCommitState).toHaveBeenCalledWith({
        replay: false,
        playheadMs: 8000,
      })
    })
  })

  describe('toggleReplayMode', () => {
    it('enters when not in replay mode', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      act(() => {
        result.current.toggleReplayMode()
      })

      expect(result.current.isReplayMode).toBe(true)
    })

    it('exits when in replay mode', () => {
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true })),
      )

      act(() => {
        result.current.toggleReplayMode()
      })

      expect(result.current.isReplayMode).toBe(false)
    })
  })

  describe('togglePlayPause', () => {
    it('enters replay mode and starts playing when not in replay mode', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      act(() => {
        result.current.togglePlayPause()
      })

      expect(result.current.isReplayMode).toBe(true)
      expect(result.current.isPlaying).toBe(true)
    })

    it('pauses when already playing', () => {
      const { result } = renderHook(() => useReplayMode(createProps()))

      act(() => {
        result.current.togglePlayPause()
      })
      act(() => {
        result.current.togglePlayPause()
      })

      expect(result.current.isReplayMode).toBe(true)
      expect(result.current.isPlaying).toBe(false)
    })
  })

  describe('clearPlayhead', () => {
    it('clears everything and commits null state', () => {
      const onCommitState = vi.fn()
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true, onCommitState })),
      )

      act(() => {
        result.current.setPlayheadMs(5000)
      })

      act(() => {
        result.current.clearPlayhead()
      })

      expect(result.current.isReplayMode).toBe(false)
      expect(result.current.effectivePlayheadMs).toBeNull()
      expect(onCommitState).toHaveBeenCalledWith({
        replay: false,
        playheadMs: null,
      })
    })
  })

  describe('setPlayheadMs', () => {
    it('clamps to valid range', () => {
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true, maxMs: 10000 })),
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
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true })),
      )

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
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true })),
      )

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
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true })),
      )

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

  describe('posthog tracking', () => {
    it('captures replay_mode_entered when entering replay mode', () => {
      const posthog = createMockPosthog()
      const { result } = renderHook(() =>
        useReplayMode(createProps({ posthog })),
      )

      act(() => {
        result.current.enterReplayMode()
      })

      expect(posthog.capture).toHaveBeenCalledWith('replay_mode_entered')
    })

    it('captures replay_mode_exited when exiting replay mode', () => {
      const posthog = createMockPosthog()
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true, posthog })),
      )

      act(() => {
        result.current.exitReplayMode()
      })

      expect(posthog.capture).toHaveBeenCalledWith('replay_mode_exited')
    })

    it('captures the correct event on toggleReplayMode', () => {
      const posthog = createMockPosthog()
      const { result } = renderHook(() =>
        useReplayMode(createProps({ posthog })),
      )

      act(() => {
        result.current.toggleReplayMode()
      })
      expect(posthog.capture).toHaveBeenLastCalledWith('replay_mode_entered')

      act(() => {
        result.current.toggleReplayMode()
      })
      expect(posthog.capture).toHaveBeenLastCalledWith('replay_mode_exited')
    })
  })

  describe('stepping', () => {
    it('steps forward by 1 second', () => {
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true })),
      )

      act(() => {
        result.current.setPlayheadMs(5000)
      })

      act(() => {
        result.current.stepForward()
      })

      expect(result.current.effectivePlayheadMs).toBe(6000)
    })

    it('steps forward by 100ms with fineStep', () => {
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true })),
      )

      act(() => {
        result.current.setPlayheadMs(5000)
      })

      act(() => {
        result.current.stepForward(true)
      })

      expect(result.current.effectivePlayheadMs).toBe(5100)
    })

    it('steps backward by 1 second', () => {
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true })),
      )

      act(() => {
        result.current.setPlayheadMs(5000)
      })

      act(() => {
        result.current.stepBackward()
      })

      expect(result.current.effectivePlayheadMs).toBe(4000)
    })

    it('steps backward by 100ms with fineStep', () => {
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true })),
      )

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
        useReplayMode(createProps({ committedReplay: true, maxMs: 5500 })),
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
      const { result } = renderHook(() =>
        useReplayMode(createProps({ committedReplay: true })),
      )

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
