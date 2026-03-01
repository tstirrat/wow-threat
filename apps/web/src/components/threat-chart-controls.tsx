/**
 * Top action controls for threat chart interactions.
 */
import { Info } from 'lucide-react'
import { type FC, useId } from 'react'

import type { BossDamageMode } from '../types/app'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Kbd } from './ui/kbd'
import { Label } from './ui/label'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
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
  showFixateBands: boolean
  onShowFixateBandsChange: (showFixateBands: boolean) => void
  showEnergizeEvents: boolean
  onShowEnergizeEventsChange: (showEnergizeEvents: boolean) => void
  bossDamageMode: BossDamageMode
  onBossDamageModeChange: (bossDamageMode: BossDamageMode) => void
  inferThreatReduction: boolean
  onInferThreatReductionChange: (inferThreatReduction: boolean) => void
}

export const ThreatChartControls: FC<ThreatChartControlsProps> = ({
  showClearIsolate,
  onResetZoom,
  onClearIsolate,
  showFixateBands,
  onShowFixateBandsChange,
  showEnergizeEvents,
  onShowEnergizeEventsChange,
  bossDamageMode,
  onBossDamageModeChange,
  inferThreatReduction,
  onInferThreatReductionChange,
}) => {
  const showFixateBandsId = useId()
  const showEnergizeEventsId = useId()
  const bossDamageModeId = useId()
  const inferThreatReductionId = useId()

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" type="button" variant="outline" onClick={onResetZoom}>
          Reset zoom
        </Button>
        {showClearIsolate ? (
          <Button
            aria-label="Clear isolate"
            size="sm"
            type="button"
            variant="outline"
            onClick={onClearIsolate}
          >
            <span>Clear isolate</span>
            <span
              aria-hidden="true"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            >
              <Kbd className="h-4 min-w-4 px-1 text-[0.55rem] leading-none">
                C
              </Kbd>
            </span>
          </Button>
        ) : null}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={showFixateBands}
            id={showFixateBandsId}
            onCheckedChange={(checked) => {
              onShowFixateBandsChange(checked === true)
            }}
          />
          <Label
            className="inline-flex cursor-pointer items-center gap-1 text-sm"
            htmlFor={showFixateBandsId}
          >
            <span>Show fixate areas</span>
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={showEnergizeEvents}
            id={showEnergizeEventsId}
            onCheckedChange={(checked) => {
              onShowEnergizeEventsChange(checked === true)
            }}
          />
          <Label
            className="inline-flex cursor-pointer items-center gap-1 text-sm"
            htmlFor={showEnergizeEventsId}
          >
            <span>Show energize events</span>
            <Kbd
              aria-hidden="true"
              className="h-4 min-w-4 px-1 text-[0.55rem] leading-none"
            >
              E
            </Kbd>
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Label className="inline-flex items-center gap-1 text-sm">
            <span id={bossDamageModeId}>Boss damage</span>
            <Kbd
              aria-hidden="true"
              className="h-4 min-w-4 px-1 text-[0.55rem] leading-none"
            >
              B
            </Kbd>
          </Label>
          <ToggleGroup
            variant="outline"
            aria-labelledby={bossDamageModeId}
            onValueChange={(value) => {
              if (value === 'off' || value === 'melee' || value === 'all') {
                onBossDamageModeChange(value)
              }
            }}
            type="single"
            value={bossDamageMode}
          >
            <ToggleGroupItem aria-label="Boss damage off" value="off">
              Off
            </ToggleGroupItem>
            <ToggleGroupItem aria-label="Boss damage melee" value="melee">
              Melee
            </ToggleGroupItem>
            <ToggleGroupItem aria-label="Boss damage all" value="all">
              All
            </ToggleGroupItem>
          </ToggleGroup>
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
              <ul className="list-disc pl-4">
                <li>
                  Infers Salvation for non-tank players when a Paladin is
                  present in the fight
                </li>
                <li>Attempts to emulate Tranquil Air Totem if dropped</li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
