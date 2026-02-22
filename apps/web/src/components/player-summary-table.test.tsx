/**
 * Component tests for focused-player table Wowhead link rendering.
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { FocusedPlayerSummary, FocusedPlayerThreatRow } from '../types/app'
import { PlayerSummaryTable } from './player-summary-table'

const summary: FocusedPlayerSummary = {
  actorId: 1,
  label: 'Aegistank',
  actorClass: 'Warrior',
  talentPoints: [8, 5, 38],
  totalThreat: 1200,
  totalTps: 10,
  totalDamage: 900,
  totalHealing: 20,
  color: '#c79c6e',
}

const rows: FocusedPlayerThreatRow[] = [
  {
    key: 'ability-23922',
    abilityId: 23922,
    abilityName: 'Shield Slam',
    amount: 600,
    threat: 300,
    tps: 2.5,
    isHeal: false,
    isFixate: false,
  },
]

describe('PlayerSummaryTable', () => {
  it('uses configured wowhead domain for ability and aura links', () => {
    render(
      <PlayerSummaryTable
        summary={summary}
        rows={rows}
        initialAuras={[
          {
            spellId: 71,
            name: 'Defensive Stance',
            stacks: 1,
            isNotable: true,
          },
        ]}
        wowhead={{
          domain: 'tbc',
        }}
      />,
    )

    const abilityLink = screen.getByRole('link', {
      name: 'Shield Slam',
    })
    expect(abilityLink).toHaveAttribute(
      'href',
      'https://www.wowhead.com/tbc/spell=23922',
    )
    expect(abilityLink).toHaveAttribute(
      'data-wowhead',
      'spell=23922&domain=tbc',
    )

    const auraLink = screen.getByRole('link', {
      name: 'Defensive Stance',
    })
    expect(auraLink).toHaveAttribute(
      'href',
      'https://www.wowhead.com/tbc/spell=71',
    )
    expect(auraLink).toHaveAttribute('data-wowhead', 'spell=71&domain=tbc')
  })

  it('styles heal amounts and fixate rows while omitting fixate tps', () => {
    render(
      <PlayerSummaryTable
        summary={summary}
        rows={[
          {
            key: 'ability-48438',
            abilityId: 48438,
            abilityName: 'Wild Growth',
            amount: 120,
            threat: 60,
            tps: 1.2,
            isHeal: true,
            isFixate: false,
          },
          {
            key: 'ability-355',
            abilityId: 355,
            abilityName: 'Taunt',
            amount: 0,
            threat: 100000,
            tps: null,
            isHeal: false,
            isFixate: true,
          },
        ]}
        initialAuras={[]}
        wowhead={{
          domain: 'tbc',
        }}
      />,
    )

    const healRow = screen.getByRole('row', { name: /Wild Growth/ })
    expect(healRow).toHaveStyle({ color: '#22c55e' })

    const fixateRow = screen.getByRole('row', { name: /Taunt/ })
    expect(fixateRow).toHaveStyle({ color: '#ffa500' })

    const fixateCells = within(fixateRow).getAllByRole('cell')
    expect(fixateCells[3]).toBeEmptyDOMElement()
  })
})
