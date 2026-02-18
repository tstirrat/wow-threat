/**
 * Scrollable legend for threat chart actor visibility and isolation controls.
 */
import type { FC } from 'react'

import type { ThreatSeries } from '../types/app'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { ScrollArea } from './ui/scroll-area'

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
    <Card
      aria-label="Threat legend"
      className="min-h-0 max-h-[560px] bg-panel"
      size="sm"
    >
      <CardHeader className="border-b border-border">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          Legend
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className="h-full">
          <ul className="py-1">
            {series.map((item) => {
              const isVisible = isActorVisible(item.actorId)
              return (
                <li className="px-1" key={item.actorId}>
                  <Button
                    aria-label={`Toggle ${item.label}`}
                    aria-pressed={isVisible}
                    className={`h-auto w-full justify-start gap-2 py-1 text-left text-xs ${
                      isVisible ? 'text-foreground' : 'text-muted'
                    }`}
                    title="Click to toggle visibility. Double-click to isolate."
                    type="button"
                    variant="ghost"
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
                  </Button>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
