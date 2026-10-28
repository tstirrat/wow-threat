/**
 * Region placement tests for the fight workspace grid.
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FightWorkspace } from './fight-workspace'

function getRegion(name: string): HTMLElement {
  const region = screen
    .getByRole('region', { name: 'Fight workspace' })
    .querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (!region) {
    throw new Error(`Missing region ${name}`)
  }

  return region
}

describe('FightWorkspace', () => {
  it('places each slot in its named grid area', () => {
    render(
      <FightWorkspace
        chart={<p>chart content</p>}
        roster={<p>roster content</p>}
        transport={<p>transport content</p>}
        drawer={<p>drawer content</p>}
      />,
    )

    const regions = ['chart', 'roster', 'transport', 'drawer']
    regions.forEach((name) => {
      const region = getRegion(name)
      expect(within(region).getByText(`${name} content`)).toBeInTheDocument()
      expect(region.className).toContain(`[grid-area:${name}]`)
    })
  })

  it('names chart and roster side by side on large screens', () => {
    render(<FightWorkspace chart={null} />)

    expect(
      screen.getByRole('region', { name: 'Fight workspace' }).className,
    ).toContain("'chart_roster'")
  })

  it('hides the roster region and gives the chart the full width when roster is hidden', () => {
    render(<FightWorkspace chart={null} isRosterVisible={false} roster="x" />)

    const workspace = screen.getByRole('region', { name: 'Fight workspace' })
    expect(workspace.className).not.toContain("'chart_roster'")
    expect(getRegion('roster').className).toContain('hidden')
  })

  it('omits transport and drawer regions when they have no content', () => {
    render(<FightWorkspace chart={<p>chart</p>} />)

    const workspace = screen.getByRole('region', { name: 'Fight workspace' })
    expect(workspace.querySelector('[data-region="transport"]')).toBeNull()
    expect(workspace.querySelector('[data-region="drawer"]')).toBeNull()
  })

  it('names the workspace region from the label prop', () => {
    render(<FightWorkspace label="Patchwerk fight workspace" chart={null} />)

    expect(
      screen.getByRole('region', { name: 'Patchwerk fight workspace' }),
    ).toBeInTheDocument()
  })

  it('exposes the roster container through rosterRef', () => {
    let rosterContainer: HTMLDivElement | null = null
    render(
      <FightWorkspace
        chart={null}
        rosterRef={(element) => {
          rosterContainer = element
        }}
      />,
    )

    expect(rosterContainer).not.toBeNull()
    expect(getRegion('roster').contains(rosterContainer)).toBe(true)
  })
})
