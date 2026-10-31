/**
 * Common formatting helpers for numeric and date-like values.
 */

/** Format a number with thousands separators and no fixed precision. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

/** Format milliseconds into a compact seconds label. */
export function formatSeconds(valueMs: number): string {
  return `${(valueMs / 1000).toFixed(1)}s`
}

/** Format milliseconds into m:ss.mmm for timeline axis/tooltip display. */
export function formatTimelineTime(valueMs: number): string {
  const safeValueMs = Math.max(0, Math.round(valueMs))
  const minutes = Math.floor(safeValueMs / 60_000)
  const seconds = Math.floor((safeValueMs % 60_000) / 1_000)
  const milliseconds = safeValueMs % 1_000

  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

/** Visible axis span below which tick labels include milliseconds. */
const AXIS_MILLISECOND_SPAN_MS = 10_000

/** Format an axis tick as m:ss, adding milliseconds when zoomed to a short span. */
export function formatAxisTime(valueMs: number, spanMs: number): string {
  return spanMs < AXIS_MILLISECOND_SPAN_MS
    ? formatTimelineTime(valueMs)
    : formatClockDuration(valueMs)
}

function formatOrdinal(value: number): string {
  const remainder10 = value % 10
  const remainder100 = value % 100

  if (remainder10 === 1 && remainder100 !== 11) {
    return `${value}st`
  }
  if (remainder10 === 2 && remainder100 !== 12) {
    return `${value}nd`
  }
  if (remainder10 === 3 && remainder100 !== 13) {
    return `${value}rd`
  }

  return `${value}th`
}

/** Format milliseconds into an `m:ss` clock string. */
export function formatClockDuration(valueMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Format a report start timestamp for compact header display. */
export function formatReportHeaderDate(valueMs: number): string {
  const date = new Date(valueMs)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(
    date,
  )
  const hour24 = date.getHours()
  const minutes = date.getMinutes()
  const meridiem = hour24 >= 12 ? 'pm' : 'am'
  const hour12 = hour24 % 12 || 12
  const timeLabel =
    minutes === 0
      ? `${hour12}${meridiem}`
      : `${hour12}:${String(minutes).padStart(2, '0')}${meridiem}`

  return `${weekday} ${formatOrdinal(date.getDate())} ${timeLabel}`
}

/** Format a report start as "9th Jun 2026 @ 6am PST" in the viewer's local time zone. */
export function formatReportSummaryDate(valueMs: number): string {
  const date = new Date(valueMs)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(
    date,
  )
  const hour24 = date.getHours()
  const minutes = date.getMinutes()
  const meridiem = hour24 >= 12 ? 'pm' : 'am'
  const hour12 = hour24 % 12 || 12
  const timeLabel =
    minutes === 0
      ? `${hour12}${meridiem}`
      : `${hour12}:${String(minutes).padStart(2, '0')}${meridiem}`
  const zone =
    new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? ''

  return `${formatOrdinal(date.getDate())} ${month} ${date.getFullYear()} @ ${timeLabel} ${zone}`.trim()
}

/** Format a report start timestamp with year and time, e.g. "Oct 28, 2026, 7:30 PM". */
export function formatReportListDate(valueMs: number): string {
  const date = new Date(valueMs)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

/** Format a Unix-milliseconds timestamp as a readable local date/time. */
export function formatDateTime(valueMs: number): string {
  const date = new Date(valueMs)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
