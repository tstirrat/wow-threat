/**
 * Sizing and legend placement tests for the threat chart.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CSSProperties, FC } from 'react'
import { HotkeysProvider } from 'react-hotkeys-hook'
import { describe, expect, it, vi } from 'vitest'

import type { ThreatPoint, ThreatSeries } from '../types/app'
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

function createZoomablePoints(): ThreatPoint[] {
  return [0, 10000].map((timeMs) => ({
    timestamp: timeMs,
    timeMs,
    totalThreat: timeMs / 100,
    threatDelta: 0,
    amount: 0,
    baseThreat: 0,
    modifiedThreat: 0,
    spellSchool: null,
    eventType: 'damage',
    abilityName: 'Hit',
    modifiers: [],
  }))
}

function renderChart(overrides: Partial<ThreatChartProps> = {}) {
  return render(
    <HotkeysProvider initiallyActiveScopes={['fight-page']}>
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
      />
    </HotkeysProvider>,
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
    expect(canvasRegion.className).toContain('min-h-[240px]')
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

  describe('hotkeys', () => {
    it('shift+i isolates the focused player and plain i does nothing', async () => {
      const onToggleFocusedPlayerIsolation = vi.fn()
      renderChart({ focusedActorId: 1, onToggleFocusedPlayerIsolation })

      await userEvent.keyboard('i')
      expect(onToggleFocusedPlayerIsolation).not.toHaveBeenCalled()

      await userEvent.keyboard('{Shift>}i{/Shift}')
      expect(onToggleFocusedPlayerIsolation).toHaveBeenCalledWith(1)
    })

    it('p pins the focused player but not with a modifier held', async () => {
      const onTogglePinnedPlayer = vi.fn()
      renderChart({ focusedActorId: 1, onTogglePinnedPlayer })

      await userEvent.keyboard('{Meta>}p{/Meta}')
      expect(onTogglePinnedPlayer).not.toHaveBeenCalled()

      await userEvent.keyboard('p')
      expect(onTogglePinnedPlayer).toHaveBeenCalledWith(1)
    })

    it('p does nothing without a focused player', async () => {
      const onTogglePinnedPlayer = vi.fn()
      renderChart({ focusedActorId: null, onTogglePinnedPlayer })

      await userEvent.keyboard('p')
      expect(onTogglePinnedPlayer).not.toHaveBeenCalled()
    })

    it('o opens threat overrides for the focused player', async () => {
      const onOpenPlayerOverrides = vi.fn()
      renderChart({ focusedActorId: 1, onOpenPlayerOverrides })

      await userEvent.keyboard('o')
      expect(onOpenPlayerOverrides).toHaveBeenCalledWith(1)
    })

    it('h hides and shows the focused player line', async () => {
      const legendContainer = document.createElement('div')
      document.body.append(legendContainer)
      renderChart({ focusedActorId: 1, legendContainer })
      const toggle = screen.getByTitle(/Click to toggle visibility/)
      expect(toggle.getAttribute('aria-pressed')).toBe('true')

      await userEvent.keyboard('h')
      expect(toggle.getAttribute('aria-pressed')).toBe('false')

      await userEvent.keyboard('h')
      expect(toggle.getAttribute('aria-pressed')).toBe('true')
      legendContainer.remove()
    })

    it('r, e and shift+p no longer trigger chart actions', async () => {
      const onShowPetsChange = vi.fn()
      const onTogglePinnedPlayer = vi.fn()
      renderChart({
        focusedActorId: 1,
        onShowPetsChange,
        onTogglePinnedPlayer,
      })

      await userEvent.keyboard('re')
      expect(onShowPetsChange).not.toHaveBeenCalled()
      expect(onTogglePinnedPlayer).not.toHaveBeenCalled()
    })
  })

  it('shows a floating reset zoom button only while zoomed', async () => {
    const onWindowChange = vi.fn()
    const full = renderChart({
      onWindowChange,
      series: [
        createSeries({
          actorId: 1,
          label: 'Tanky',
          points: createZoomablePoints(),
        }),
      ],
    })
    expect(screen.queryByRole('button', { name: 'Reset zoom' })).toBeNull()
    full.unmount()

    renderChart({
      onWindowChange,
      windowStartMs: 2000,
      windowEndMs: 5000,
      series: [
        createSeries({
          actorId: 1,
          label: 'Tanky',
          points: createZoomablePoints(),
        }),
      ],
    })
    await userEvent.click(screen.getByRole('button', { name: 'Reset zoom' }))
    expect(onWindowChange).toHaveBeenCalledWith(null, null)
  })

  it('hides the floating reset zoom button in replay mode', () => {
    renderChart({
      isReplayMode: true,
      windowStartMs: 2000,
      windowEndMs: 5000,
      series: [
        createSeries({
          actorId: 1,
          label: 'Tanky',
          points: createZoomablePoints(),
        }),
      ],
    })
    expect(screen.queryByRole('button', { name: 'Reset zoom' })).toBeNull()
  })
})
