/**
 * Sizing and legend placement tests for the threat chart.
 */
import { render, screen } from '@testing-library/react'
import type { CSSProperties, FC } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { ThreatSeries } from '../types/app'
import { ThreatChart, type ThreatChartProps } from './threat-chart'

vi.mock('echarts-for-react/esm/core', () => {
  const ReactEChartsCoreMock: FC<{
    className?: string
    style?: CSSProperties
  }> = ({ className, style }) => (
    <div
      className={`echarts-for-react ${className ?? ''}`}
      data-testid="echarts"
      style={style}
    />
  )

  return { default: ReactEChartsCoreMock }
})

function createSeries(
  overrides: Pick<ThreatSeries, 'actorId' | 'label'> & Partial<ThreatSeries>,
): ThreatSeries {
  return {
    actorName: overrides.label,
    actorClass: 'Warrior',
    actorType: 'Player',
    ownerId: null,
    color: '#c79c6e',
    points: [],
    maxThreat: 0,
    totalThreat: 0,
    totalDamage: 0,
    totalHealing: 0,
    stateVisualSegments: [],
    fixateWindows: [],
    invulnerabilityWindows: [],
    ...overrides,
  }
}

function renderChart(overrides: Partial<ThreatChartProps> = {}) {
  return render(
    <ThreatChart
      bossDamageMode="off"
      onFocusAndAddPlayer={vi.fn()}
      onFocusAndIsolatePlayer={vi.fn()}
      onOpenPlayerOverrides={vi.fn()}
      onSeriesClick={vi.fn()}
      onShowPetsChange={vi.fn()}
      onToggleFocusedPlayerIsolation={vi.fn()}
      onTogglePinnedPlayer={vi.fn()}
      onWindowChange={vi.fn()}
      series={[createSeries({ actorId: 1, label: 'Tanky' })]}
      showEnergizeEvents={false}
      showFixateBands={false}
      showPets={false}
      windowEndMs={null}
      windowStartMs={null}
      {...overrides}
    />,
  )
}

describe('ThreatChart', () => {
  it('fills its container height instead of a fixed pixel height', () => {
    renderChart()

    const chart = screen.getByTestId('echarts')
    expect(chart.style.height).toBe('100%')
    expect(chart.style.width).toBe('100%')

    const canvasRegion = screen.getByTestId('threat-chart-canvas-region')
    expect(canvasRegion.className).toContain('flex-1')
    expect(canvasRegion.className).toContain('min-h-[560px]')
  })

  it('renders the legend into the provided legend container', () => {
    const legendContainer = document.createElement('div')
    document.body.append(legendContainer)

    const { container } = renderChart({ legendContainer })

    const legend = screen.getByLabelText('Threat legend')
    expect(legendContainer.contains(legend)).toBe(true)
    expect(container.contains(legend)).toBe(false)

    legendContainer.remove()
  })

  it('renders no legend without a legend container', () => {
    renderChart()

    expect(screen.queryByLabelText('Threat legend')).toBeNull()
  })
})
