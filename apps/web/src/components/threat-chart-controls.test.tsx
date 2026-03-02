/**
 * Unit tests for threat chart controls behavior.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ThreatChartControls } from './threat-chart-controls'

describe('ThreatChartControls', () => {
  it('disables reset zoom button when chart is not ready', () => {
    render(
      <ThreatChartControls
        onResetZoom={vi.fn()}
        isResetZoomDisabled
        showFixateBands
        onShowFixateBandsChange={vi.fn()}
        showEnergizeEvents={false}
        onShowEnergizeEventsChange={vi.fn()}
        bossDamageMode="melee"
        onBossDamageModeChange={vi.fn()}
        inferThreatReduction={false}
        onInferThreatReductionChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeDisabled()
  })

  it('emits fixate toggle changes', async () => {
    const onShowFixateBandsChange = vi.fn()
    render(
      <ThreatChartControls
        onResetZoom={vi.fn()}
        showFixateBands
        onShowFixateBandsChange={onShowFixateBandsChange}
        showEnergizeEvents={false}
        onShowEnergizeEventsChange={vi.fn()}
        bossDamageMode="melee"
        onBossDamageModeChange={vi.fn()}
        inferThreatReduction={false}
        onInferThreatReductionChange={vi.fn()}
      />,
    )

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Show fixate areas' }),
    )

    expect(onShowFixateBandsChange).toHaveBeenCalledWith(false)
  })
})
