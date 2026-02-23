/**
 * Top action controls for threat chart interactions.
 */
import { type FC, useId } from 'react'

import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'

export interface ThreatChartControlsProps {
  showClearIsolate: boolean
  onResetZoom: () => void
  onClearIsolate: () => void
  showEnergizeEvents: boolean
  onShowEnergizeEventsChange: (showEnergizeEvents: boolean) => void
}

export const ThreatChartControls: FC<ThreatChartControlsProps> = ({
  showClearIsolate,
  onResetZoom,
  onClearIsolate,
  showEnergizeEvents,
  onShowEnergizeEventsChange,
}) => {
  const showEnergizeEventsId = useId()

  return (
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
    </div>
  )
}
