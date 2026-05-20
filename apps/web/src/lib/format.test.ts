/**
 * Tests for common formatting helpers.
 */
import { describe, expect, it } from 'vitest'

import {
  formatClockDuration,
  formatNumber,
  formatReportHeaderDate,
  formatSeconds,
  formatTimelineTime,
} from './format'

describe('formatTimelineTime', () => {
  it('formats zero as 0:00.000', () => {
    expect(formatTimelineTime(0)).toBe('0:00.000')
  })

  it('formats sub-second values', () => {
    expect(formatTimelineTime(500)).toBe('0:00.500')
  })

  it('formats exactly one second', () => {
    expect(formatTimelineTime(1000)).toBe('0:01.000')
  })

  it('formats values with minutes', () => {
    expect(formatTimelineTime(65500)).toBe('1:05.500')
  })

  it('clamps negative values to zero', () => {
    expect(formatTimelineTime(-100)).toBe('0:00.000')
  })

  it('pads seconds and milliseconds', () => {
    expect(formatTimelineTime(61009)).toBe('1:01.009')
  })
})

describe('formatClockDuration', () => {
  it('formats zero as 0:00', () => {
    expect(formatClockDuration(0)).toBe('0:00')
  })

  it('formats sub-minute durations', () => {
    expect(formatClockDuration(30000)).toBe('0:30')
  })

  it('formats exactly one minute', () => {
    expect(formatClockDuration(60000)).toBe('1:00')
  })

  it('formats over one minute', () => {
    expect(formatClockDuration(61000)).toBe('1:01')
  })

  it('pads seconds below 10', () => {
    expect(formatClockDuration(65000)).toBe('1:05')
  })

  it('clamps negative values to zero', () => {
    expect(formatClockDuration(-5000)).toBe('0:00')
  })
})

describe('formatNumber', () => {
  it('formats small integers', () => {
    expect(formatNumber(42)).toBe('42')
  })

  it('adds thousands separator', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('rounds decimals', () => {
    expect(formatNumber(1.6)).toBe('2')
  })
})

describe('formatSeconds', () => {
  it('formats milliseconds as seconds with one decimal', () => {
    expect(formatSeconds(1500)).toBe('1.5s')
  })

  it('formats zero', () => {
    expect(formatSeconds(0)).toBe('0.0s')
  })
})

describe('formatReportHeaderDate ordinal suffixes', () => {
  function ordinalFor(day: number): string {
    // Use a known weekday; we only care about the ordinal portion
    const date = new Date(2026, 0, day) // January has days 1-31
    return formatReportHeaderDate(date.getTime()).split(' ')[1]
  }

  it('uses st for 1st', () => {
    expect(ordinalFor(1)).toBe('1st')
  })

  it('uses nd for 2nd', () => {
    expect(ordinalFor(2)).toBe('2nd')
  })

  it('uses rd for 3rd', () => {
    expect(ordinalFor(3)).toBe('3rd')
  })

  it('uses th for 4th', () => {
    expect(ordinalFor(4)).toBe('4th')
  })

  it('uses th for 11th (teen exception)', () => {
    expect(ordinalFor(11)).toBe('11th')
  })

  it('uses th for 12th (teen exception)', () => {
    expect(ordinalFor(12)).toBe('12th')
  })

  it('uses th for 13th (teen exception)', () => {
    expect(ordinalFor(13)).toBe('13th')
  })

  it('uses st for 21st', () => {
    expect(ordinalFor(21)).toBe('21st')
  })

  it('uses nd for 22nd', () => {
    expect(ordinalFor(22)).toBe('22nd')
  })

  it('uses rd for 23rd', () => {
    expect(ordinalFor(23)).toBe('23rd')
  })
})
