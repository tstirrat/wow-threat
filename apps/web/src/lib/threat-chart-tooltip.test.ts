/**
 * Unit tests for threat chart tooltip formatter output.
 */
import { HitTypeCode, ResourceTypeCode } from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import type { ThreatSeries } from '../types/app'
import { createThreatChartTooltipFormatter } from './threat-chart-tooltip'

const baseSeries: ThreatSeries = {
  actorId: 1,
  actorName: 'Tank',
  actorClass: 'Warrior',
  actorType: 'Player',
  ownerId: null,
  label: 'Tank',
  color: '#c79c6e',
  points: [],
  maxThreat: 0,
  totalThreat: 0,
  totalDamage: 0,
  totalHealing: 0,
  stateVisualSegments: [],
  fixateWindows: [],
  invulnerabilityWindows: [],
}

describe('threat-chart-tooltip', () => {
  it('renders escaped names with aura, marker, split, and modifiers rows', () => {
    const formatter = createThreatChartTooltipFormatter({
      series: [
        {
          ...baseSeries,
          stateVisualSegments: [
            {
              kind: 'fixate',
              spellId: 694,
              spellName: 'Mocking Blow',
              startMs: 10000,
              endMs: 20000,
            },
          ],
        },
      ],
      themeColors: {
        border: '#d1d5db',
        foreground: '#0f172a',
        muted: '#64748b',
        panel: '#ffffff',
      },
    })

    const tooltip = formatter({
      seriesName: 'Tank <A>',
      data: {
        actorId: 1,
        actorColor: '#a855f7',
        abilityName: 'Sunder <Armor>',
        amount: 240,
        baseThreat: 0,
        eventType: 'damage',
        hitType: 6,
        note: 'base < calc',
        modifiedThreat: 300,
        spellId: 7386,
        spellSchool: 'Fire',
        modifiers: [
          {
            name: 'Defensive <Stance>',
            schoolLabels: ['physical'],
            value: 1.3,
          },
        ],
        threatDelta: 100,
        timeMs: 15000,
        totalThreat: 1200,
        markerKind: 'tranquilAirTotem',
      },
    })

    expect(tooltip).toContain('Sunder &lt;Armor&gt; [glancing]')
    expect(tooltip).toContain('Tank &lt;A&gt;')
    expect(tooltip).toContain('T: 0:15.000')
    expect(tooltip).toContain('Amt: 240.00 (fire)')
    expect(tooltip).toContain('Note: <strong>base &lt; calc</strong>')
    expect(tooltip).toContain('Threat: 300.00 / 3 = 100.00')
    expect(tooltip).toContain('Multipliers:')
    expect(tooltip).toContain('1.30')
    const multipliersIndex = tooltip.indexOf('Multipliers:')
    const threatIndex = tooltip.indexOf('Threat: 300.00 / 3 = 100.00')
    expect(multipliersIndex).toBeGreaterThanOrEqual(0)
    expect(threatIndex).toBeGreaterThan(multipliersIndex)
    expect(tooltip).toContain('Defensive &lt;Stance&gt;')
    expect(tooltip).toContain(
      'Aura: <strong style="color:#ffa500">fixate (Mocking Blow)</strong>',
    )
    expect(tooltip).toContain(
      'Marker: <strong style="color:#3b82f6">Tranquil Air Totem</strong>',
    )
    expect(tooltip).toContain('ID: 7386')
  })

  it('hides threat rows for boss-damage marker tooltips', () => {
    const formatter = createThreatChartTooltipFormatter({
      series: [baseSeries],
      themeColors: {
        border: '#d1d5db',
        foreground: '#0f172a',
        muted: '#64748b',
        panel: '#ffffff',
      },
    })

    const tooltip = formatter({
      seriesName: 'Tank',
      data: {
        actorId: 1,
        actorColor: '#a855f7',
        abilityName: 'Melee',
        amount: 700,
        baseThreat: 0,
        eventType: 'damage',
        modifiedThreat: 0,
        spellId: 1,
        spellSchool: null,
        modifiers: [{ name: 'Defensive Stance', schoolLabels: [], value: 1.3 }],
        threatDelta: 0,
        timeMs: 15000,
        totalThreat: 1200,
        markerKind: 'bossMelee',
      },
    })

    expect(tooltip).toContain('↓ Melee (incoming)')
    expect(tooltip).toContain('Amt: 700.00')
    expect(tooltip).toContain(
      'Marker: <strong style="color:#ef4444">Boss damage</strong>',
    )
    expect(tooltip).not.toContain('Threat:')
    expect(tooltip).not.toContain('Multipliers:')
    expect(tooltip).not.toContain('&sum;')
  })

  it('renders death marker tooltips with only title, time, and marker', () => {
    const formatter = createThreatChartTooltipFormatter({
      series: [baseSeries],
      themeColors: {
        border: '#d1d5db',
        foreground: '#0f172a',
        muted: '#64748b',
        panel: '#ffffff',
      },
    })

    const tooltip = formatter({
      seriesName: 'Tank',
      data: {
        actorId: 1,
        actorColor: '#a855f7',
        abilityName: 'Unknown ability',
        amount: 0,
        baseThreat: 0,
        eventType: 'death',
        modifiedThreat: 0,
        spellSchool: null,
        modifiers: [{ name: 'Defensive Stance', schoolLabels: [], value: 1.3 }],
        threatDelta: 0,
        timeMs: 15000,
        totalThreat: 1200,
        markerKind: 'death',
      },
    })

    expect(tooltip).toContain(
      '<span style="text-decoration:line-through">Tank</span> <span>(death)</span>',
    )
    expect(tooltip).toContain('text-decoration:line-through')
    expect(tooltip).toContain('T: 0:15.000')
    expect(tooltip).toContain(
      'Marker: <strong style="color:#dc2626">Death</strong>',
    )
    expect(tooltip).not.toContain('Unknown ability')
    expect(tooltip).not.toContain('Amt:')
    expect(tooltip).not.toContain('Threat:')
    expect(tooltip).not.toContain('Multipliers:')
    expect(tooltip).not.toContain('&sum;')
  })

  it('renders tranquil air totem marker labels', () => {
    const formatter = createThreatChartTooltipFormatter({
      series: [baseSeries],
      themeColors: {
        border: '#d1d5db',
        foreground: '#0f172a',
        muted: '#64748b',
        panel: '#ffffff',
      },
    })

    const tooltip = formatter({
      seriesName: 'Shaman',
      data: {
        actorId: 1,
        actorColor: '#3b82f6',
        abilityName: 'Tranquil Air Totem',
        amount: 0,
        baseThreat: 0,
        eventType: 'summon',
        modifiedThreat: 0,
        spellId: 25908,
        spellSchool: null,
        modifiers: [],
        threatDelta: 0,
        timeMs: 1000,
        totalThreat: 500,
        markerKind: 'tranquilAirTotem',
      },
    })

    expect(tooltip).toContain(
      'Marker: <strong style="color:#3b82f6">Tranquil Air Totem</strong>',
    )
  })

  it('renders resource labels and non-damage event suffixes', () => {
    const formatter = createThreatChartTooltipFormatter({
      series: [baseSeries],
      themeColors: {
        border: '#d1d5db',
        foreground: '#0f172a',
        muted: '#64748b',
        panel: '#ffffff',
      },
    })

    const tooltip = formatter({
      seriesName: 'Tank',
      data: {
        actorId: 1,
        actorColor: '#c79c6e',
        abilityName: 'Bloodrage',
        amount: 20,
        baseThreat: 0,
        eventType: 'energize',
        modifiedThreat: -55,
        resourceType: ResourceTypeCode.Rage,
        spellSchool: null,
        modifiers: [{ name: 'Normal', schoolLabels: [], value: 1 }],
        threatDelta: -55,
        timeMs: 5000,
        totalThreat: 145,
      },
    })

    expect(tooltip).toContain('Bloodrage (energize)')
    expect(tooltip).toContain('Rage: 20.00')
    expect(tooltip).toContain('Threat: -55.00')
    expect(tooltip).not.toContain('Multipliers:')
    expect(tooltip).not.toContain('ID:')
  })

  it('does not render hit type when result is a normal hit', () => {
    const formatter = createThreatChartTooltipFormatter({
      series: [baseSeries],
      themeColors: {
        border: '#d1d5db',
        foreground: '#0f172a',
        muted: '#64748b',
        panel: '#ffffff',
      },
    })

    const tooltip = formatter({
      seriesName: 'Tank',
      data: {
        actorId: 1,
        actorColor: '#c79c6e',
        abilityName: 'Heroic Strike',
        amount: 400,
        baseThreat: 400,
        eventType: 'damage',
        hitType: 1,
        modifiedThreat: 400,
        spellSchool: 'Physical',
        modifiers: [],
        threatDelta: 400,
        timeMs: 10000,
        totalThreat: 400,
      },
    })

    expect(tooltip).not.toContain('Heroic Strike [')
  })

  it('renders non-hit string hit types in the title', () => {
    const formatter = createThreatChartTooltipFormatter({
      series: [baseSeries],
      themeColors: {
        border: '#d1d5db',
        foreground: '#0f172a',
        muted: '#64748b',
        panel: '#ffffff',
      },
    })

    const tooltip = formatter({
      seriesName: 'Tank',
      data: {
        actorId: 1,
        actorColor: '#c79c6e',
        abilityName: 'Heroic Strike',
        amount: 400,
        baseThreat: 400,
        eventType: 'damage',
        hitType: HitTypeCode.Crit,
        modifiedThreat: 400,
        spellSchool: 'Physical',
        modifiers: [],
        threatDelta: 400,
        timeMs: 10000,
        totalThreat: 400,
      },
    })

    expect(tooltip).toContain('Heroic Strike [crit]')
  })

  it('renders heal target names and tick labels for periodic events', () => {
    const formatter = createThreatChartTooltipFormatter({
      series: [baseSeries],
      themeColors: {
        border: '#d1d5db',
        foreground: '#0f172a',
        muted: '#64748b',
        panel: '#ffffff',
      },
    })

    const directHealTooltip = formatter({
      seriesName: 'Healer',
      data: {
        actorId: 1,
        actorColor: '#22c55e',
        abilityName: 'Wild Growth',
        targetName: 'TargetPlayer',
        amount: 2000,
        baseThreat: 0,
        eventType: 'heal',
        modifiedThreat: 1000,
        spellSchool: null,
        modifiers: [],
        threatDelta: 500,
        timeMs: 1000,
        totalThreat: 500,
      },
    })

    const healTickTooltip = formatter({
      seriesName: 'Healer',
      data: {
        actorId: 1,
        actorColor: '#22c55e',
        abilityName: 'Wild Growth',
        targetName: 'TargetPlayer',
        amount: 500,
        baseThreat: 0,
        eventType: 'heal',
        isTick: true,
        modifiedThreat: 250,
        spellSchool: null,
        modifiers: [],
        threatDelta: 125,
        timeMs: 2000,
        totalThreat: 625,
      },
    })

    const damageTickTooltip = formatter({
      seriesName: 'Warlock',
      data: {
        actorId: 1,
        actorColor: '#a78bfa',
        abilityName: 'Corruption',
        amount: 300,
        baseThreat: 300,
        eventType: 'damage',
        isTick: true,
        modifiedThreat: 300,
        spellSchool: 'Shadow',
        modifiers: [],
        threatDelta: 300,
        timeMs: 3000,
        totalThreat: 925,
      },
    })

    const absorbedTooltip = formatter({
      seriesName: 'Priest',
      data: {
        actorId: 1,
        actorColor: '#ffffff',
        abilityName: 'Power Word: Shield',
        targetName: 'TargetPlayer',
        amount: 800,
        baseThreat: 0,
        eventType: 'absorbed',
        modifiedThreat: 0,
        spellSchool: null,
        modifiers: [],
        threatDelta: 0,
        timeMs: 3500,
        totalThreat: 925,
      },
    })

    expect(directHealTooltip).toContain('Wild Growth → TargetPlayer (heal)')
    expect(healTickTooltip).toContain('Wild Growth → TargetPlayer (tick)')
    expect(damageTickTooltip).toContain('Corruption (tick)')
    expect(absorbedTooltip).toContain(
      'Power Word: Shield @ TargetPlayer (absorbed)',
    )
  })

  it('renders spell modifier inside multipliers with cumulative total and bonus prefix', () => {
    const formatter = createThreatChartTooltipFormatter({
      series: [baseSeries],
      themeColors: {
        border: '#d1d5db',
        foreground: '#0f172a',
        muted: '#64748b',
        panel: '#ffffff',
      },
    })

    const tooltip = formatter({
      seriesName: 'Tank',
      data: {
        actorId: 1,
        actorColor: '#c79c6e',
        abilityName: 'Execute',
        amount: 450,
        baseThreat: 1161,
        eventType: 'damage',
        modifiedThreat: 1161,
        spellSchool: 'Physical',
        spellModifier: {
          type: 'spell',
          value: 2,
          bonus: 261,
        },
        modifiers: [
          {
            name: 'Defensive Stance',
            schoolLabels: [],
            value: 3,
          },
          {
            name: 'Neutral',
            schoolLabels: [],
            value: 1,
          },
        ],
        threatDelta: 1161,
        timeMs: 10000,
        totalThreat: 1161,
      },
    })

    expect(tooltip).toContain('Multipliers:')
    expect(tooltip).toContain('∑ 6.00')
    expect(tooltip).toContain('>Execute</span><span>(+261) 2.00</span>')
    expect(tooltip).toContain('Defensive Stance')
    expect(tooltip).toContain('>3.00</span>')
    expect(tooltip).not.toContain('Spell modifier:')
  })

  it('labels heal spell modifier rows as Heal', () => {
    const formatter = createThreatChartTooltipFormatter({
      series: [baseSeries],
      themeColors: {
        border: '#d1d5db',
        foreground: '#0f172a',
        muted: '#64748b',
        panel: '#ffffff',
      },
    })

    const tooltip = formatter({
      seriesName: 'Healer',
      data: {
        actorId: 1,
        actorColor: '#22c55e',
        abilityName: 'Flash Heal',
        amount: 700,
        baseThreat: 350,
        eventType: 'heal',
        modifiedThreat: 350,
        spellSchool: 'Holy',
        spellModifier: {
          type: 'spell',
          value: 1.5,
          bonus: 0,
        },
        modifiers: [],
        threatDelta: 350,
        timeMs: 1000,
        totalThreat: 350,
      },
    })

    expect(tooltip).toContain('Multipliers:')
    expect(tooltip).toContain('∑ 1.50')
    expect(tooltip).toContain('>Heal</span><span>1.50</span>')
    expect(tooltip).not.toContain('>Flash Heal</span><span>1.50</span>')
  })
})
