/**
 * Chart series click handling for threat chart actor focus interactions.
 */
import { useCallback } from 'react'

export interface ThreatChartSeriesClickParams {
  componentType?: string
  data?: {
    focusedActorId?: number | string | null
  }
  seriesName?: string
  seriesType?: string
}

/** Resolve clicked actor ID from chart payloads and invoke series-focus callback. */
export function useThreatChartSeriesClickHandler({
  actorIdByLabel,
  consumeSuppressedSeriesClick,
  onSeriesClick,
}: {
  actorIdByLabel: Map<string, number>
  consumeSuppressedSeriesClick: () => boolean
  onSeriesClick: (actorId: number) => void
}): (params: ThreatChartSeriesClickParams) => void {
  return useCallback(
    (params: ThreatChartSeriesClickParams): void => {
      if (consumeSuppressedSeriesClick()) {
        return
      }

      if (params.componentType !== 'series' || params.seriesType !== 'line') {
        return
      }

      const payloadActorId = Number(params.data?.focusedActorId)
      if (Number.isFinite(payloadActorId) && payloadActorId > 0) {
        onSeriesClick(payloadActorId)
        return
      }

      if (!params.seriesName) {
        return
      }

      const clickedActorId = actorIdByLabel.get(params.seriesName)
      if (!clickedActorId) {
        return
      }

      onSeriesClick(clickedActorId)
    },
    [actorIdByLabel, consumeSuppressedSeriesClick, onSeriesClick],
  )
}
