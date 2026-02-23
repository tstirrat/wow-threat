/**
 * Scrollable legend for threat chart actor visibility and isolation controls.
 */
import { Eye } from 'lucide-react'
import { type FC, useId } from 'react'

import type { ThreatSeries } from '../types/app'
import { Button } from './ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from './ui/card'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { ScrollArea } from './ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

export interface ThreatChartLegendProps {
  series: ThreatSeries[]
  isActorVisible: (actorId: number) => boolean
  onActorClick: (actorId: number) => void
  onActorFocus: (actorId: number) => void
  showPets: boolean
  onShowPetsChange: (showPets: boolean) => void
}

export const ThreatChartLegend: FC<ThreatChartLegendProps> = ({
  series,
  isActorVisible,
  onActorClick,
  onActorFocus,
  showPets,
  onShowPetsChange,
}) => {
  const showPetsId = useId()

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
        <CardAction>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={showPets}
              id={showPetsId}
              onCheckedChange={(checked) => {
                onShowPetsChange(checked === true)
              }}
            />
            <Label
              className="text-xs text-muted-foreground"
              htmlFor={showPetsId}
            >
              Show pets
            </Label>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <TooltipProvider>
          <ScrollArea className="h-full">
            <ul className="py-1">
              {series.map((item) => {
                const isVisible = isActorVisible(item.actorId)
                const label =
                  item.actorType === 'Pet' ? item.actorName : item.label
                return (
                  <li
                    className={`overflow-hidden pr-1 ${
                      item.actorType === 'Pet' ? 'pl-4' : 'pl-1'
                    }`}
                    key={item.actorId}
                  >
                    <div className="flex min-w-0 items-center gap-1">
                      <Button
                        aria-label={`Toggle ${label}`}
                        aria-pressed={isVisible}
                        className={`h-auto min-w-0 flex-1 cursor-pointer justify-start gap-2 py-1 text-left text-xs ${
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
                            item.actorType === 'Pet' ? 'text-[11px]' : ''
                          } ${isVisible ? '' : 'line-through'}`}
                          style={{ color: item.color }}
                        >
                          {label}
                        </span>
                      </Button>
                      {item.actorType === 'Player' ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              aria-label={`Focus ${label}`}
                              className="h-6 w-6 cursor-pointer"
                              size="icon-xs"
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                onActorFocus(item.actorId)
                              }}
                            >
                              <Eye />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">{`Focus ${label}`}</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
