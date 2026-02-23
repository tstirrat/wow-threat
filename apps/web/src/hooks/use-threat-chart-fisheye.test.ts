/**
 * Unit tests for the threat chart fisheye interaction hook.
 */
import { act, renderHook } from '@testing-library/react'
import type ReactEChartsCore from 'echarts-for-react/lib/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useThreatChartFisheye } from './use-threat-chart-fisheye'

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

const axisMaxPixel = 960
const axisMinPixel = 60

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
    return axisMinPixel + ratio * (axisMaxPixel - axisMinPixel)
  })

  const convertFromPixel = vi.fn((_query: unknown, pixel: number) => {
    const ratio = (pixel - axisMinPixel) / (axisMaxPixel - axisMinPixel)
    return bounds.min + ratio * (bounds.max - bounds.min)
  })

  const containPixel = vi.fn((_query: unknown, pointer: [number, number]) => {
    return (
      pointer[0] >= axisMinPixel &&
      pointer[0] <= axisMaxPixel &&
      pointer[1] >= 0 &&
      pointer[1] <= chartHeight
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

function renderFisheyeHook({
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
    useThreatChartFisheye({
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

describe('use-threat-chart-fisheye', () => {
  it('applies an axis break from in-grid drag selection', () => {
    const { result, setOption, zr } = renderFisheyeHook()

    act(() => {
      zr.trigger('mousedown', { offsetX: 160, offsetY: 80 })
      zr.trigger('mousemove', { offsetX: 460, offsetY: 80 })
      zr.trigger('mouseup', { offsetX: 460, offsetY: 80 })
    })

    expect(result.current.axisBreaks).toHaveLength(1)
    expect(result.current.axisBreaks[0]).toMatchObject({
      gap: '80%',
      isExpanded: false,
    })
    expect(result.current.axisBreaks[0]?.start).toBeCloseTo(111.11, 2)
    expect(result.current.axisBreaks[0]?.end).toBeCloseTo(444.44, 2)

    const lastSetOptionCall = setOption.mock.calls.at(-1)?.[0] as {
      xAxis: { breaks: Array<{ end: number; start: number }> }
    }
    expect(lastSetOptionCall.xAxis.breaks[0]?.start).toBeCloseTo(111.11, 2)
    expect(lastSetOptionCall.xAxis.breaks[0]?.end).toBeCloseTo(444.44, 2)

    expect(result.current.consumeSuppressedSeriesClick()).toBe(true)
    expect(result.current.consumeSuppressedSeriesClick()).toBe(false)
  })

  it('finalizes drag selection from window mouseup', () => {
    const { result, zr } = renderFisheyeHook()

    act(() => {
      zr.trigger('mousedown', { offsetX: 120, offsetY: 100 })
      zr.trigger('mousemove', { offsetX: 720, offsetY: 120 })
    })

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { clientX: 720, clientY: 120 }),
      )
    })

    expect(result.current.axisBreaks).toHaveLength(1)
    expect(result.current.axisBreaks[0]?.start).toBeCloseTo(66.67, 2)
    expect(result.current.axisBreaks[0]?.end).toBeCloseTo(733.33, 2)
  })

  it('ignores drag selections smaller than the minimum width', () => {
    const { result, setOption, zr } = renderFisheyeHook()

    act(() => {
      zr.trigger('mousedown', { offsetX: 200, offsetY: 50 })
      zr.trigger('mouseup', { offsetX: 206, offsetY: 60 })
    })

    expect(result.current.axisBreaks).toEqual([])
    expect(setOption).not.toHaveBeenCalled()
  })

  it('clears breaks and reports full window on double click reset', () => {
    const { onWindowChange, result, setOption, zr } = renderFisheyeHook()

    act(() => {
      zr.trigger('mousedown', { offsetX: 180, offsetY: 80 })
      zr.trigger('mouseup', { offsetX: 540, offsetY: 80 })
    })

    expect(result.current.axisBreaks).toHaveLength(1)

    act(() => {
      zr.trigger('dblclick', { offsetX: 320, offsetY: 140 })
    })

    expect(result.current.axisBreaks).toEqual([])
    expect(setOption).toHaveBeenLastCalledWith({
      xAxis: {
        breaks: [],
      },
    })
    expect(onWindowChange).toHaveBeenCalledWith(null, null)
    expect(result.current.consumeSuppressedSeriesClick()).toBe(true)
    expect(result.current.consumeSuppressedSeriesClick()).toBe(false)
  })
})
