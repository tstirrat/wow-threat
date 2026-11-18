/**
 * PostHog tracking for fight page load milestones.
 *
 * Fires fight_loaded, threat_chart_loaded, and threat_chart_failed automatically
 * via effects. Each event fires once per report+fight and includes a load_time_ms
 * measured from when that report+fight became the current page (the page
 * component stays mounted across fight and report navigation).
 */
import type { PostHog } from 'posthog-js'
import { useEffect, useRef } from 'react'

export interface UseFightPageLoadTrackingParams {
  fightId: number
  reportId: string
  fightData: { name: string } | null
  eventsQueryError: Error | null
  isChartReady: boolean
  visibleSeriesCount: number
  posthog?: PostHog
}

function resolveLoadTimeMs(
  start: { key: string; at: number } | null,
  pageKey: string,
): number | undefined {
  return start?.key === pageKey
    ? Math.round(performance.now() - start.at)
    : undefined
}

/** Track fight page load milestones via PostHog. */
export function useFightPageLoadTracking({
  fightId,
  reportId,
  fightData,
  eventsQueryError,
  isChartReady,
  visibleSeriesCount,
  posthog,
}: UseFightPageLoadTrackingParams): void {
  const pageKey = `${reportId}:${fightId}`
  const pageStartRef = useRef<{ key: string; at: number } | null>(null)
  const trackedFightLoadedRef = useRef<string | null>(null)
  const trackedChartLoadedRef = useRef<string | null>(null)
  const trackedChartFailedRef = useRef<string | null>(null)

  useEffect(() => {
    pageStartRef.current = { key: pageKey, at: performance.now() }
  }, [pageKey])

  useEffect(() => {
    if (!fightData || !posthog) return
    if (trackedFightLoadedRef.current === pageKey) return
    trackedFightLoadedRef.current = pageKey
    posthog.capture('fight_loaded', {
      report_id: reportId,
      fight_id: fightId,
      boss_name: fightData.name,
      load_time_ms: resolveLoadTimeMs(pageStartRef.current, pageKey),
    })
  }, [fightData, pageKey, posthog, reportId, fightId])

  useEffect(() => {
    if (!isChartReady || visibleSeriesCount === 0 || !posthog) return
    if (trackedChartLoadedRef.current === pageKey) return
    trackedChartLoadedRef.current = pageKey
    posthog.capture('threat_chart_loaded', {
      report_id: reportId,
      fight_id: fightId,
      player_count: visibleSeriesCount,
      load_time_ms: resolveLoadTimeMs(pageStartRef.current, pageKey),
    })
  }, [isChartReady, fightId, pageKey, posthog, reportId, visibleSeriesCount])

  useEffect(() => {
    if (!eventsQueryError || !posthog) return
    if (trackedChartFailedRef.current === pageKey) return
    trackedChartFailedRef.current = pageKey
    posthog.capture('threat_chart_failed', {
      report_id: reportId,
      fight_id: fightId,
      error_message: eventsQueryError.message,
      load_time_ms: resolveLoadTimeMs(pageStartRef.current, pageKey),
    })
  }, [eventsQueryError, fightId, pageKey, posthog, reportId])
}
