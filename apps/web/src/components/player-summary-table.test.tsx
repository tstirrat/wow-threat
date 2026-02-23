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
  modifiers: [],
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
    modifierTotal: 1,
    modifierBreakdown: [],
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
            modifierTotal: 1,
            modifierBreakdown: [],
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
            modifierTotal: 1,
            modifierBreakdown: [],
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
    expect(fixateCells[4]).toBeEmptyDOMElement()
  })

  it('renders resource-labeled ability rows as wowhead links', () => {
    render(
      <PlayerSummaryTable
        summary={summary}
        rows={[
          {
            key: 'ability-2687-resourcechange',
            abilityId: 2687,
            abilityName: 'Bloodrage (resource change)',
            amount: 0,
            threat: 40,
            tps: 0.4,
            isHeal: false,
            isFixate: false,
            modifierTotal: 1,
            modifierBreakdown: [],
          },
        ]}
        initialAuras={[]}
        wowhead={{
          domain: 'tbc',
        }}
      />,
    )

    const abilityLink = screen.getByRole('link', {
      name: 'Bloodrage (resource change)',
    })
    expect(abilityLink).toHaveAttribute(
      'href',
      'https://www.wowhead.com/tbc/spell=2687',
    )
  })

  it('renders modifiers and ability modifier breakdown details', () => {
    render(
      <PlayerSummaryTable
        summary={{
          ...summary,
          modifiers: [
            {
              key: '12305:defiance',
              spellId: 12305,
              name: 'Defiance (Rank 5)',
              schoolLabels: [],
              value: 1.15,
            },
            {
              key: '20470:improved-rf',
              spellId: 20470,
              name: 'Improved Righteous Fury (Rank 3)',
              schoolLabels: ['holy'],
              value: 1.19,
            },
          ],
        }}
        rows={[
          {
            key: 'ability-23922',
            abilityId: 23922,
            abilityName: 'Shield Slam',
            spellSchool: 'holy',
            amount: 600,
            threat: 300,
            tps: 2.5,
            isHeal: false,
            isFixate: false,
            modifierTotal: 1.37,
            modifierBreakdown: [
              {
                name: 'Defensive Stance',
                schoolLabels: [],
                value: 1.3,
              },
              {
                name: 'Defiance',
                schoolLabels: ['holy'],
                value: 1.05,
              },
            ],
          },
        ]}
        initialAuras={[]}
        wowhead={{
          domain: 'tbc',
        }}
      />,
    )

    expect(screen.getByText('Defiance (Rank 5)')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Defiance (Rank 5)' }),
    ).toHaveAttribute('data-wowhead', 'spell=12305&domain=tbc')
    expect(
      screen.getByRole('link', {
        name: 'Improved Righteous Fury (Rank 3) (holy)',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'Improved Righteous Fury (Rank 3) (holy)',
      }),
    ).toHaveAttribute('data-wowhead', 'spell=20470&domain=tbc')
    expect(screen.getByText('x1.37')).toBeInTheDocument()
    expect(screen.getByText('Modifier breakdown')).toBeInTheDocument()
    expect(screen.getByText('Ability school: holy')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Shield Slam/ })).toHaveStyle({
      color: '#FFE680',
    })
    expect(screen.getByRole('tooltip')).toHaveClass('bottom-full')
  })

  it('keeps heal row color while coloring heal modifier by spell school', () => {
    render(
      <PlayerSummaryTable
        summary={summary}
        rows={[
          {
            key: 'ability-2061',
            abilityId: 2061,
            abilityName: 'Flash Heal',
            spellSchool: 'fire',
            amount: 700,
            threat: 350,
            tps: 3.5,
            isHeal: true,
            isFixate: false,
            modifierTotal: 1.2,
            modifierBreakdown: [
              {
                name: 'School Modifier',
                schoolLabels: ['fire'],
                value: 1.2,
              },
            ],
          },
        ]}
        initialAuras={[]}
        wowhead={{
          domain: 'tbc',
        }}
      />,
    )

    const healRow = screen.getByRole('row', { name: /Flash Heal/ })
    expect(healRow).toHaveStyle({ color: '#22c55e' })
    expect(screen.getByRole('button', { name: 'x1.20' })).toHaveStyle({
      color: '#FF8000',
    })
  })

  it('keeps physical heal modifiers neutral', () => {
    render(
      <PlayerSummaryTable
        summary={summary}
        rows={[
          {
            key: 'ability-49924',
            abilityId: 49924,
            abilityName: 'Death Strike',
            spellSchool: 'physical',
            amount: 700,
            threat: 350,
            tps: 3.5,
            isHeal: true,
            isFixate: false,
            modifierTotal: 1.2,
            modifierBreakdown: [
              {
                name: 'Physical Bonus',
                schoolLabels: ['physical'],
                value: 1.2,
              },
            ],
          },
        ]}
        initialAuras={[]}
        wowhead={{
          domain: 'tbc',
        }}
      />,
    )

    expect(screen.getByRole('button', { name: 'x1.20' })).not.toHaveStyle({
      color: '#FFFF00',
    })
    expect(screen.getByRole('button', { name: 'x1.20' })).toHaveClass(
      'text-foreground',
    )
  })

  it('keeps physical and non-specific modifiers neutral while coloring specific schools', () => {
    render(
      <PlayerSummaryTable
        summary={{
          ...summary,
          modifiers: [
            {
              key: 'generic-bonus',
              name: 'Generic Bonus',
              schoolLabels: [],
              value: 1.1,
            },
            {
              key: 'physical-bonus',
              name: 'Physical Bonus',
              schoolLabels: ['physical'],
              value: 1.2,
            },
            {
              key: 'holy-bonus',
              name: 'Holy Bonus',
              schoolLabels: ['holy'],
              value: 1.1,
            },
          ],
        }}
        rows={[
          {
            key: 'ability-23922',
            abilityId: 23922,
            abilityName: 'Shield Slam',
            spellSchool: 'holy',
            amount: 600,
            threat: 300,
            tps: 2.5,
            isHeal: false,
            isFixate: false,
            modifierTotal: 1.37,
            modifierBreakdown: [
              {
                name: 'Generic Breakdown',
                schoolLabels: [],
                value: 1.1,
              },
              {
                name: 'Physical Breakdown',
                schoolLabels: ['physical'],
                value: 1.2,
              },
              {
                name: 'Holy Breakdown',
                schoolLabels: ['holy'],
                value: 1.04,
              },
            ],
          },
        ]}
        initialAuras={[]}
        wowhead={{
          domain: 'tbc',
        }}
      />,
    )

    const genericSummaryModifier = screen
      .getByText('Generic Bonus')
      .closest('li')
    const physicalSummaryModifier = screen
      .getByText('Physical Bonus (physical)')
      .closest('li')
    const holySummaryModifier = screen
      .getByText('Holy Bonus (holy)')
      .closest('li')

    expect(genericSummaryModifier).not.toBeNull()
    expect(physicalSummaryModifier).not.toBeNull()
    expect(holySummaryModifier).not.toBeNull()

    expect(genericSummaryModifier).not.toHaveStyle({
      color: '#FFFF00',
    })
    expect(physicalSummaryModifier).not.toHaveStyle({
      color: '#FFFF00',
    })
    expect(holySummaryModifier).toHaveStyle({
      color: '#FFE680',
    })

    const tooltip = screen.getByRole('tooltip')
    const genericBreakdownModifier = within(tooltip)
      .getByText('Generic Breakdown')
      .closest('div')
    const physicalBreakdownModifier = within(tooltip)
      .getByText('Physical Breakdown (physical)')
      .closest('div')
    const holyBreakdownModifier = within(tooltip)
      .getByText('Holy Breakdown (holy)')
      .closest('div')

    expect(genericBreakdownModifier).not.toBeNull()
    expect(physicalBreakdownModifier).not.toBeNull()
    expect(holyBreakdownModifier).not.toBeNull()

    expect(genericBreakdownModifier).not.toHaveStyle({
      color: '#FFFF00',
    })
    expect(physicalBreakdownModifier).not.toHaveStyle({
      color: '#FFFF00',
    })
    expect(holyBreakdownModifier).toHaveStyle({
      color: '#FFE680',
    })
  })

  it('applies combo spell school colors to non-heal rows', () => {
    render(
      <PlayerSummaryTable
        summary={summary}
        rows={[
          {
            key: 'ability-49184',
            abilityId: 49184,
            abilityName: 'Howling Blast',
            spellSchool: 'frost/shadow',
            amount: 700,
            threat: 350,
            tps: 3.5,
            isHeal: false,
            isFixate: false,
            modifierTotal: 1,
            modifierBreakdown: [],
          },
        ]}
        initialAuras={[]}
        wowhead={{
          domain: 'tbc',
        }}
      />,
    )

    expect(screen.getByRole('row', { name: /Howling Blast/ })).toHaveStyle({
      color: '#80C6FF',
    })
  })

  it('keeps physical and resource change rows uncolored', () => {
    render(
      <PlayerSummaryTable
        summary={summary}
        rows={[
          {
            key: 'ability-47450',
            abilityId: 47450,
            abilityName: 'Heroic Strike',
            spellSchool: 'physical',
            amount: 700,
            threat: 350,
            tps: 3.5,
            isHeal: false,
            isFixate: false,
            modifierTotal: 1,
            modifierBreakdown: [],
          },
          {
            key: 'ability-2687:resourcechange',
            abilityId: 2687,
            abilityName: 'Bloodrage (resourcechange)',
            spellSchool: 'fire',
            amount: 0,
            threat: 40,
            tps: 0.4,
            isHeal: false,
            isFixate: false,
            modifierTotal: 1,
            modifierBreakdown: [],
          },
        ]}
        initialAuras={[]}
        wowhead={{
          domain: 'tbc',
        }}
      />,
    )

    expect(screen.getByRole('row', { name: /Heroic Strike/ })).not.toHaveStyle({
      color: '#FFFF00',
    })
    expect(
      screen.getByRole('row', { name: /Bloodrage \(resourcechange\)/ }),
    ).not.toHaveStyle({
      color: '#FF8000',
    })
  })

  it('formats table numbers with decimal threat, decimal tps, and whole-number amount', () => {
    render(
      <PlayerSummaryTable
        summary={{
          ...summary,
          totalThreat: 1200.123,
          totalTps: 10,
          totalDamage: 900.7,
          totalHealing: 20.2,
        }}
        rows={[
          {
            key: 'ability-23922',
            abilityId: 23922,
            abilityName: 'Shield Slam',
            spellSchool: 'holy',
            amount: 1234.56,
            threat: 789.126,
            tps: 3.5,
            isHeal: false,
            isFixate: false,
            modifierTotal: 1.2,
            modifierBreakdown: [
              {
                name: 'Holy Bonus',
                schoolLabels: ['holy'],
                value: 1.2,
              },
            ],
          },
        ]}
        initialAuras={[]}
        wowhead={{
          domain: 'tbc',
        }}
      />,
    )

    const abilityRow = screen.getByRole('row', { name: /Shield Slam/ })
    const abilityCells = within(abilityRow).getAllByRole('cell')
    expect(abilityCells[1]).toHaveTextContent('1,235')
    expect(abilityCells[2]).toHaveTextContent('789.13')
    expect(abilityCells[3]).toHaveTextContent('x1.20')
    expect(abilityCells[4]).toHaveTextContent('3.50')
    expect(abilityCells[1]).toHaveClass('text-right', 'tabular-nums')
    expect(abilityCells[2]).toHaveClass('text-right', 'tabular-nums')
    expect(abilityCells[3]).toHaveClass('text-right', 'tabular-nums')
    expect(abilityCells[4]).toHaveClass('text-right', 'tabular-nums')

    const totalRow = screen.getByRole('row', {
      name: /Total 921 1,200.12 - 10.00/,
    })
    const totalCells = within(totalRow).getAllByRole('cell')
    expect(totalCells[1]).toHaveTextContent('921')
    expect(totalCells[2]).toHaveTextContent('1,200.12')
    expect(totalCells[4]).toHaveTextContent('10.00')

    const columnHeaders = screen.getAllByRole('columnheader')
    expect(columnHeaders[1]).toHaveClass('text-right')
    expect(columnHeaders[2]).toHaveClass('text-right')
    expect(columnHeaders[3]).toHaveClass('text-right')
    expect(columnHeaders[4]).toHaveClass('text-right')
  })
})
