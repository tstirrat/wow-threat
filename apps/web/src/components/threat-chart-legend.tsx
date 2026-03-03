/**
 * Scrollable legend for threat chart actor visibility and isolation controls.
 */
import { Eye, Pin, Plus, RotateCcw, Shield } from 'lucide-react'
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
  pinnedPlayerIds: number[]
  onTogglePinnedPlayer: (playerId: number) => void
  showClearSelections: boolean
  onClearSelections: () => void
  showPets: boolean
  onShowPetsChange: (showPets: boolean) => void
}

export const ThreatChartLegend: FC<ThreatChartLegendProps> = ({
  series,
  isActorVisible,
  onActorClick,
  onActorFocus,
  pinnedPlayerIds,
  onTogglePinnedPlayer,
  showClearSelections,
  onClearSelections,
  showPets,
  onShowPetsChange,
}) => {
  const showPetsId = useId()
  const pinnedPlayerIdSet = new Set(pinnedPlayerIds)

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
            {showClearSelections ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Clear selections"
                      className="h-6 w-6 cursor-pointer"
                      size="icon-xs"
                      type="button"
                      variant="ghost"
                      onClick={onClearSelections}
                    >
                      <RotateCcw />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Clear selections</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
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
      <CardContent className="min-h-0 flex flex-1 flex-col p-0">
        <TooltipProvider delayDuration={0}>
          <ScrollArea className="min-h-0 flex-1">
            <ul className="py-1">
              {series.map((item) => {
                const isVisible = isActorVisible(item.actorId)
                const isTank =
                  item.actorType === 'Player' && item.actorRole === 'Tank'
                const isHealer =
                  item.actorType === 'Player' && item.actorRole === 'Healer'
                const isPinnable = item.actorType === 'Player'
                const isPinned =
                  isPinnable && pinnedPlayerIdSet.has(item.actorId)
                const label =
                  item.actorType === 'Pet' ? item.actorName : item.label
                return (
                  <li
                    className={`overflow-hidden pr-1 ${
                      item.actorType === 'Pet' ? 'pl-4' : 'pl-1'
                    }`}
                    key={item.actorId}
                  >
                    <div className="group flex min-w-0 items-center gap-1">
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
                          {isTank ? (
                            <Shield
                              aria-hidden="true"
                              className={`ml-1 inline h-3 w-3 flex-shrink-0 ${
                                isVisible
                                  ? 'text-amber-500'
                                  : 'text-amber-500/60'
                              }`}
                            />
                          ) : null}
                          {isHealer ? (
                            <span
                              aria-label="Healer role"
                              className="ml-1 inline-flex"
                            >
                              <Plus
                                aria-hidden="true"
                                className="inline h-3 w-3 flex-shrink-0"
                              />
                            </span>
                          ) : null}
                        </span>
                      </Button>
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
                      {isPinnable ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              aria-label={`Toggle pin ${label}`}
                              aria-pressed={isPinned}
                              className={`h-6 w-6 cursor-pointer transition-opacity ${
                                isPinned
                                  ? 'text-amber-500 opacity-100'
                                  : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                              }`}
                              size="icon-xs"
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                onTogglePinnedPlayer(item.actorId)
                              }}
                            >
                              <Pin />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {isPinned ? `Unpin ${label}` : `Pin ${label}`}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        </TooltipProvider>
        <div className="border-t border-border px-2 py-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-3 w-5 rounded-[2px]"
              style={{
                background:
                  'linear-gradient(90deg, rgba(249, 115, 22, 0.9) 0%, rgba(249, 115, 22, 0.9) 12%, rgba(251, 146, 60, 0.22) 12%, rgba(251, 146, 60, 0.22) 100%)',
              }}
            />
            <span>Fixate/Taunt</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
