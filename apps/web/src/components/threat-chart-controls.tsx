/**
 * Top action controls for threat chart interactions.
 */
import { Info } from 'lucide-react'
import { type FC, useId } from 'react'

import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

export interface ThreatChartControlsProps {
  showClearIsolate: boolean
  onResetZoom: () => void
  onClearIsolate: () => void
  showEnergizeEvents: boolean
  onShowEnergizeEventsChange: (showEnergizeEvents: boolean) => void
  inferThreatReduction: boolean
  onInferThreatReductionChange: (inferThreatReduction: boolean) => void
}

export const ThreatChartControls: FC<ThreatChartControlsProps> = ({
  showClearIsolate,
  onResetZoom,
  onClearIsolate,
  showEnergizeEvents,
  onShowEnergizeEventsChange,
  inferThreatReduction,
  onInferThreatReductionChange,
}) => {
  const showEnergizeEventsId = useId()
  const inferThreatReductionId = useId()

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" type="button" variant="outline" onClick={onResetZoom}>
          Reset zoom
        </Button>
        {showClearIsolate ? (
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={onClearIsolate}
          >
            Clear isolate
          </Button>
        ) : null}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={showEnergizeEvents}
            id={showEnergizeEventsId}
            onCheckedChange={(checked) => {
              onShowEnergizeEventsChange(checked === true)
            }}
          />
          <Label
            className="cursor-pointer text-sm"
            htmlFor={showEnergizeEventsId}
          >
            Show energize events
          </Label>
        </div>
        <div className="flex items-center gap-1">
          <Checkbox
            checked={inferThreatReduction}
            id={inferThreatReductionId}
            onCheckedChange={(checked) => {
              onInferThreatReductionChange(checked === true)
            }}
          />
          <Label
            className="cursor-pointer text-sm"
            htmlFor={inferThreatReductionId}
          >
            Infer threat reduction buffs
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Infer threat reduction buffs help"
                className="h-6 w-6"
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <Info className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Infers Salvation for non-tank players when a Paladin is present
              in the fight.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
