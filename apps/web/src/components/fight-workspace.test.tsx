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
        header={<p>header content</p>}
        chart={<p>chart content</p>}
        roster={<p>roster content</p>}
        transport={<p>transport content</p>}
        drawer={<p>drawer content</p>}
      />,
    )

    const regions = ['header', 'chart', 'roster', 'transport', 'drawer']
    regions.forEach((name) => {
      const region = getRegion(name)
      expect(within(region).getByText(`${name} content`)).toBeInTheDocument()
      expect(region.className).toContain(`[grid-area:${name}]`)
    })
  })

  it('names chart and roster side by side on large screens', () => {
    render(<FightWorkspace header={null} chart={null} />)

    expect(
      screen.getByRole('region', { name: 'Fight workspace' }).className,
    ).toContain("'chart_roster'")
  })

  it('omits transport and drawer regions when they have no content', () => {
    render(<FightWorkspace header={null} chart={<p>chart</p>} />)

    const workspace = screen.getByRole('region', { name: 'Fight workspace' })
    expect(workspace.querySelector('[data-region="transport"]')).toBeNull()
    expect(workspace.querySelector('[data-region="drawer"]')).toBeNull()
  })

  it('exposes the roster container through rosterRef', () => {
    let rosterContainer: HTMLDivElement | null = null
    render(
      <FightWorkspace
        header={null}
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
