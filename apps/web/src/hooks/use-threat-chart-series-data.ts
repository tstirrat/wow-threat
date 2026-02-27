/**
 * Build threat chart series payloads and lookup maps for ECharts rendering.
 */
import { useMemo } from 'react'

import {
  shouldRenderThreatPoint,
  sortThreatPointsForRendering,
} from '../lib/threat-chart-event-visibility'
import {
  bossMeleeMarkerColor,
  deathMarkerColor,
  tranquilAirTotemMarkerColor,
} from '../lib/threat-chart-tooltip'
import type { SeriesChartPoint } from '../lib/threat-chart-types'
import { buildThreatStateVisualMaps } from '../lib/threat-chart-visuals'
import type { ThreatSeries } from '../types/app'

interface ThreatChartDataPoint extends SeriesChartPoint {
  emphasis: {
    itemStyle: {
      borderColor: string
      color: string
    }
  }
  itemStyle: {
    borderColor: string
    color: string
  }
}

export interface ThreatChartRenderSeries {
  actorId: number
  actorType: ThreatSeries['actorType']
  color: string
  data: ThreatChartDataPoint[]
  name: string
}

export interface UseThreatChartSeriesDataResult {
  actorIdByLabel: Map<string, number>
  chartSeries: ThreatChartRenderSeries[]
  threatStateVisualMaps: ReturnType<typeof buildThreatStateVisualMaps>
}

function resolvePointColor(
  point: ThreatSeries['points'][number],
  seriesColor: string,
): string {
  if (!point.markerKind) {
    return seriesColor
  }

  if (point.markerKind === 'bossMelee') {
    return bossMeleeMarkerColor
  }

  if (point.markerKind === 'death') {
    return deathMarkerColor
  }

  if (point.markerKind === 'tranquilAirTotem') {
    return tranquilAirTotemMarkerColor
  }

  return seriesColor
}

/** Build filtered chart series and visual overlays for threat timeline rendering. */
export function useThreatChartSeriesData({
  series,
  visibleSeries,
  showEnergizeEvents,
  showBossMelee,
}: {
  series: ThreatSeries[]
  visibleSeries: ThreatSeries[]
  showEnergizeEvents: boolean
  showBossMelee: boolean
}): UseThreatChartSeriesDataResult {
  const actorIdByLabel = useMemo(
    () => new Map(series.map((item) => [item.label, item.actorId])),
    [series],
  )

  const threatStateVisualMaps = useMemo(
    () => buildThreatStateVisualMaps(visibleSeries),
    [visibleSeries],
  )

  const chartSeries = useMemo(
    () =>
      visibleSeries.map((item) => {
        const toDataPoint = (
          point: ThreatSeries['points'][number],
        ): ThreatChartDataPoint => {
          const pointColor = resolvePointColor(point, item.color)

          return {
            ...point,
            actorId: item.actorId,
            actorColor: item.color,
            focusedActorId: item.actorId,
            value: [point.timeMs, point.totalThreat] as [number, number],
            itemStyle: {
              color: pointColor,
              borderColor: pointColor,
            },
            emphasis: {
              itemStyle: {
                color: pointColor,
                borderColor: pointColor,
              },
            },
          }
        }

        return {
          actorId: item.actorId,
          actorType: item.actorType,
          color: item.color,
          data: sortThreatPointsForRendering(
            item.points.filter((point) =>
              shouldRenderThreatPoint({
                point,
                showEnergizeEvents,
                showBossMelee,
              }),
            ),
          ).map(toDataPoint),
          name: item.label,
        }
      }),
    [showBossMelee, showEnergizeEvents, visibleSeries],
  )

  return {
    actorIdByLabel,
    chartSeries,
    threatStateVisualMaps,
  }
}
