/**
 * Scrollable legend for threat chart actor visibility and isolation controls.
 */
import type { FC } from 'react'

import type { ThreatSeries } from '../types/app'

export interface ThreatChartLegendProps {
  series: ThreatSeries[]
  isActorVisible: (actorId: number) => boolean
  onActorClick: (actorId: number) => void
}

export const ThreatChartLegend: FC<ThreatChartLegendProps> = ({
  series,
  isActorVisible,
  onActorClick,
}) => {
  return (
    <section
      aria-label="Threat legend"
      className="flex max-h-[560px] min-h-0 flex-col rounded-lg border border-border bg-panel"
    >
      <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted">
        Legend
      </p>
      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {series.map((item) => {
          const isVisible = isActorVisible(item.actorId)
          return (
            <li className="px-1" key={item.actorId}>
              <button
                aria-label={`Toggle ${item.label}`}
                aria-pressed={isVisible}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-muted/40 ${
                  isVisible ? 'text-foreground' : 'text-muted'
                }`}
                title="Click to toggle visibility. Double-click to isolate."
                type="button"
                onClick={() => {
                  onActorClick(item.actorId)
                }}
              >
                <span
                  className="w-5 border-t-2"
                  style={{
                    borderTopColor: item.color,
                    borderTopStyle:
                      item.actorType === 'Pet' ? 'dashed' : 'solid',
                    opacity: isVisible ? 1 : 0.45,
                  }}
                />
                <span
                  className={`min-w-0 flex-1 truncate font-medium ${
                    isVisible ? '' : 'line-through'
                  }`}
                  style={{ color: item.color }}
                >
                  {item.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
