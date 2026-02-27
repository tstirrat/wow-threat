/**
 * Unit tests for the threat chart drag-to-window interaction hook.
 */
import { act, renderHook } from '@testing-library/react'
import type ReactEChartsCore from 'echarts-for-react/lib/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useThreatChartZoom } from './use-threat-chart-zoom'

vi.mock('echarts', () => {
  class Rect {
    shape: { height: number; width: number; x: number; y: number }

    constructor(config: {
      shape: { height: number; width: number; x: number; y: number }
    }) {
      this.shape = config.shape
    }

    setShape(shape: { height: number; width: number; x: number; y: number }) {
      this.shape = shape
    }
  }

  return {
    graphic: {
      Rect,
    },
  }
})

type PointerEventLike = {
  offsetX?: number
  offsetY?: number
  zrX?: number
  zrY?: number
}

interface FakeZRender {
  add: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  trigger: (eventName: string, event?: PointerEventLike) => void
}

const xAxisMaxPixel = 960
const xAxisMinPixel = 60
const yAxisMaxPixel = 460
const yAxisMinPixel = 40

function isYAxisQuery(query: unknown): boolean {
  if (!query || typeof query !== 'object') {
    return false
  }

  return (
    'yAxisIndex' in query &&
    Number.isFinite((query as { yAxisIndex?: number }).yAxisIndex)
  )
}

function createFakeZRender(): FakeZRender {
  const handlers = new Map<string, (event: PointerEventLike) => void>()

  const on = vi.fn(
    (eventName: string, handler: (event: PointerEventLike) => void) => {
      handlers.set(eventName, handler)
    },
  )
  const off = vi.fn(
    (eventName: string, handler: (event: PointerEventLike) => void) => {
      if (handlers.get(eventName) === handler) {
        handlers.delete(eventName)
      }
    },
  )

  return {
    add: vi.fn(),
    remove: vi.fn(),
    on,
    off,
    trigger: (eventName, event = {}) => {
      handlers.get(eventName)?.(event)
    },
  }
}

function createMockChart(bounds: { max: number; min: number }): {
  chart: {
    containPixel: ReturnType<typeof vi.fn>
    convertFromPixel: ReturnType<typeof vi.fn>
    convertToPixel: ReturnType<typeof vi.fn>
    getDom: () => HTMLDivElement
    getWidth: () => number
    getHeight: () => number
    getZr: () => FakeZRender
    setOption: ReturnType<typeof vi.fn>
  }
  setOption: ReturnType<typeof vi.fn>
  zr: FakeZRender
} {
  const zr = createFakeZRender()
  const setOption = vi.fn()
  const dom = document.createElement('div')
  const chartWidth = 1000
  const chartHeight = 500
  Object.defineProperty(dom, 'getBoundingClientRect', {
    value: () => ({
      left: 0,
      top: 0,
      right: chartWidth,
      bottom: chartHeight,
      width: chartWidth,
      height: chartHeight,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  })

  const convertToPixel = vi.fn((_query: unknown, value: number) => {
    const ratio = (value - bounds.min) / (bounds.max - bounds.min)
    return xAxisMinPixel + ratio * (xAxisMaxPixel - xAxisMinPixel)
  })

  const convertFromPixel = vi.fn((query: unknown, pixel: number) => {
    if (isYAxisQuery(query)) {
      const ratio = (yAxisMaxPixel - pixel) / (yAxisMaxPixel - yAxisMinPixel)
      return bounds.min + ratio * (bounds.max - bounds.min)
    }

    const ratio = (pixel - xAxisMinPixel) / (xAxisMaxPixel - xAxisMinPixel)
    return bounds.min + ratio * (bounds.max - bounds.min)
  })

  const containPixel = vi.fn((_query: unknown, pointer: [number, number]) => {
    return (
      pointer[0] >= xAxisMinPixel &&
      pointer[0] <= xAxisMaxPixel &&
      pointer[1] >= yAxisMinPixel &&
      pointer[1] <= yAxisMaxPixel
    )
  })

  return {
    chart: {
      containPixel,
      convertFromPixel,
      convertToPixel,
      getDom: () => dom,
      getWidth: () => chartWidth,
      getHeight: () => chartHeight,
      getZr: () => zr,
      setOption,
    },
    setOption,
    zr,
  }
}

function renderZoomHook({
  bounds = { min: 0, max: 1000 },
  isChartReady = true,
}: {
  bounds?: { max: number; min: number }
  isChartReady?: boolean
} = {}) {
  const { chart, setOption, zr } = createMockChart(bounds)
  const onWindowChange = vi.fn()
  const chartRef = {
    current: {
      getEchartsInstance: () => chart,
    } as unknown as ReactEChartsCore,
  }

  const hook = renderHook(() =>
    useThreatChartZoom({
      bounds,
      borderColor: '#94a3b8',
      chartRef,
      isChartReady,
      onWindowChange,
      renderer: 'canvas',
    }),
  )

  return {
    ...hook,
    onWindowChange,
    setOption,
    zr,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('use-threat-chart-zoom', () => {
  it('applies a selected chart window from in-grid drag selection', () => {
    const { onWindowChange, result, setOption, zr } = renderZoomHook()

    act(() => {
      zr.trigger('mousedown', { offsetX: 160, offsetY: 80 })
      zr.trigger('mousemove', { offsetX: 460, offsetY: 80 })
      zr.trigger('mouseup', { offsetX: 460, offsetY: 80 })
    })

    expect(onWindowChange).toHaveBeenCalledWith(111, 444)
    expect(result.current.yAxisWindow).toBeNull()
    expect(setOption).not.toHaveBeenCalled()

    expect(result.current.consumeSuppressedSeriesClick()).toBe(true)
    expect(result.current.consumeSuppressedSeriesClick()).toBe(false)
  })

  it('applies a y-axis window when drag selection includes vertical range', () => {
    const { onWindowChange, result, zr } = renderZoomHook()

    act(() => {
      zr.trigger('mousedown', { offsetX: 160, offsetY: 120 })
      zr.trigger('mousemove', { offsetX: 460, offsetY: 320 })
      zr.trigger('mouseup', { offsetX: 460, offsetY: 320 })
    })

    expect(onWindowChange).toHaveBeenCalledWith(111, 444)
    expect(result.current.yAxisWindow).not.toBeNull()
    expect(result.current.yAxisWindow?.min).toBeCloseTo(333.33, 2)
    expect(result.current.yAxisWindow?.max).toBeCloseTo(809.52, 2)
  })

  it('finalizes drag selection from window mouseup', () => {
    const { onWindowChange, zr } = renderZoomHook()

    act(() => {
      zr.trigger('mousedown', { offsetX: 120, offsetY: 100 })
      zr.trigger('mousemove', { offsetX: 720, offsetY: 120 })
    })

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { clientX: 720, clientY: 120 }),
      )
    })

    expect(onWindowChange).toHaveBeenCalledWith(67, 733)
  })

  it('ignores drag selections smaller than the minimum width', () => {
    const { onWindowChange, setOption, zr } = renderZoomHook()

    act(() => {
      zr.trigger('mousedown', { offsetX: 200, offsetY: 50 })
      zr.trigger('mouseup', { offsetX: 206, offsetY: 60 })
    })

    expect(onWindowChange).not.toHaveBeenCalled()
    expect(setOption).not.toHaveBeenCalled()
  })

  it('reports full window on double click reset', () => {
    const { onWindowChange, result, setOption, zr } = renderZoomHook()

    act(() => {
      zr.trigger('mousedown', { offsetX: 180, offsetY: 80 })
      zr.trigger('mouseup', { offsetX: 540, offsetY: 220 })
    })

    expect(onWindowChange).toHaveBeenCalledWith(133, 533)
    expect(result.current.yAxisWindow).not.toBeNull()

    act(() => {
      zr.trigger('dblclick', { offsetX: 320, offsetY: 140 })
    })

    expect(setOption).not.toHaveBeenCalled()
    expect(onWindowChange).toHaveBeenCalledWith(null, null)
    expect(result.current.yAxisWindow).toBeNull()
    expect(result.current.consumeSuppressedSeriesClick()).toBe(true)
    expect(result.current.consumeSuppressedSeriesClick()).toBe(false)
  })
})
