/**
 * Drag-to-select chart window interaction for the threat chart.
 */
import * as echarts from 'echarts'
import type ReactEChartsCore from 'echarts-for-react/lib/core'
import type { MutableRefObject } from 'react'
import { useCallback, useEffect, useRef } from 'react'

const dragZoomMinWidthPx = 8

interface PointerEventLike {
  offsetX?: number
  offsetY?: number
  zrX?: number
  zrY?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Attach drag and double-click handlers that control threat chart window selection. */
export function useThreatChartZoom({
  bounds,
  borderColor,
  chartRef,
  isChartReady,
  onWindowChange,
  renderer,
}: {
  bounds: { max: number; min: number }
  borderColor: string
  chartRef: MutableRefObject<ReactEChartsCore | null>
  isChartReady: boolean
  onWindowChange: (startMs: number | null, endMs: number | null) => void
  renderer: 'canvas' | 'svg'
}): {
  consumeSuppressedSeriesClick: () => boolean
  resetZoom: () => void
} {
  const suppressNextSeriesClickRef = useRef(false)

  const resetZoom = useCallback((): void => {
    onWindowChange(null, null)
  }, [onWindowChange])

  const consumeSuppressedSeriesClick = useCallback((): boolean => {
    if (!suppressNextSeriesClickRef.current) {
      return false
    }

    suppressNextSeriesClickRef.current = false
    return true
  }, [])

  useEffect(() => {
    if (!isChartReady) {
      return
    }

    const chart = chartRef.current?.getEchartsInstance()
    if (!chart) {
      return
    }

    const zr = chart.getZr()
    let brushRect: echarts.graphic.Rect | null = null
    let dragStartPoint: [number, number] | null = null
    let lastPointer: [number, number] | null = null

    const resolvePointer = (
      event: PointerEventLike,
    ): [number, number] | null => {
      const x = event.offsetX ?? event.zrX
      const y = event.offsetY ?? event.zrY
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null
      }

      return [x, y]
    }

    const resolveDocumentPointer = (event: MouseEvent): [number, number] => {
      const rect = chart.getDom().getBoundingClientRect()
      const x = clamp(event.clientX - rect.left, 0, chart.getWidth())
      const y = clamp(event.clientY - rect.top, 0, chart.getHeight())
      return [x, y]
    }

    const clearBrushRect = (): void => {
      if (!brushRect) {
        return
      }

      zr.remove(brushRect)
      brushRect = null
    }

    const renderBrushRect = (
      startPoint: [number, number],
      endPoint: [number, number],
    ): void => {
      const x = Math.min(startPoint[0], endPoint[0])
      const y = Math.min(startPoint[1], endPoint[1])
      const width = Math.abs(endPoint[0] - startPoint[0])
      const height = Math.abs(endPoint[1] - startPoint[1])
      if (!brushRect) {
        brushRect = new echarts.graphic.Rect({
          shape: {
            x,
            y,
            width,
            height,
          },
          style: {
            fill: 'rgba(148, 163, 184, 0.2)',
            stroke: borderColor,
            lineWidth: 1,
          },
          silent: true,
          z: 1000,
        })
        zr.add(brushRect)
        return
      }

      brushRect.setShape({
        x,
        y,
        width,
        height,
      })
    }

    const finalizeDragZoom = (pointer: [number, number] | null): void => {
      const startPoint = dragStartPoint
      if (!startPoint) {
        clearBrushRect()
        return
      }

      const endPoint = pointer ?? lastPointer ?? startPoint
      dragStartPoint = null
      lastPointer = null
      clearBrushRect()

      if (Math.abs(endPoint[0] - startPoint[0]) < dragZoomMinWidthPx) {
        return
      }

      const clampedStartX = clamp(startPoint[0], 0, chart.getWidth())
      const clampedEndX = clamp(endPoint[0], 0, chart.getWidth())

      const startValue = Number(
        chart.convertFromPixel({ xAxisIndex: 0 }, clampedStartX),
      )
      const endValue = Number(
        chart.convertFromPixel({ xAxisIndex: 0 }, clampedEndX),
      )
      if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) {
        return
      }

      const activeWindowStartMs = bounds.min
      const activeWindowEndMs = bounds.max
      const clampedStart = clamp(
        Math.min(startValue, endValue),
        activeWindowStartMs,
        activeWindowEndMs,
      )
      const clampedEnd = clamp(
        Math.max(startValue, endValue),
        activeWindowStartMs,
        activeWindowEndMs,
      )
      if (clampedEnd - clampedStart < 1) {
        return
      }

      onWindowChange(Math.round(clampedStart), Math.round(clampedEnd))
      suppressNextSeriesClickRef.current = true
    }

    const handleMouseDown = (event: PointerEventLike): void => {
      const pointer = resolvePointer(event)
      const isInGrid = pointer
        ? chart.containPixel({ gridIndex: 0 }, pointer)
        : false
      if (!pointer || !isInGrid) {
        return
      }

      dragStartPoint = pointer
      lastPointer = pointer
      renderBrushRect(pointer, pointer)
    }

    const handleMouseMove = (event: PointerEventLike): void => {
      const startPoint = dragStartPoint
      if (!startPoint) {
        return
      }

      const pointer = resolvePointer(event)
      if (!pointer) {
        return
      }

      lastPointer = pointer
      renderBrushRect(startPoint, pointer)
    }

    const handleMouseUp = (event: PointerEventLike): void => {
      finalizeDragZoom(resolvePointer(event))
    }

    const handleDocumentMouseUp = (event: MouseEvent): void => {
      finalizeDragZoom(resolveDocumentPointer(event))
    }

    const handleDoubleClick = (event: PointerEventLike): void => {
      const pointer = resolvePointer(event)
      const isInGrid = pointer
        ? chart.containPixel({ gridIndex: 0 }, pointer)
        : false
      if (!isInGrid) {
        return
      }

      dragStartPoint = null
      lastPointer = null
      clearBrushRect()
      suppressNextSeriesClickRef.current = true
      resetZoom()
    }

    zr.on('mousedown', handleMouseDown)
    zr.on('mousemove', handleMouseMove)
    zr.on('mouseup', handleMouseUp)
    zr.on('dblclick', handleDoubleClick)
    window.addEventListener('mouseup', handleDocumentMouseUp)

    return () => {
      zr.off('mousedown', handleMouseDown)
      zr.off('mousemove', handleMouseMove)
      zr.off('mouseup', handleMouseUp)
      zr.off('dblclick', handleDoubleClick)
      window.removeEventListener('mouseup', handleDocumentMouseUp)
      clearBrushRect()
    }
  }, [
    borderColor,
    bounds.max,
    bounds.min,
    chartRef,
    isChartReady,
    onWindowChange,
    renderer,
    resetZoom,
  ])

  return {
    consumeSuppressedSeriesClick,
    resetZoom,
  }
}
