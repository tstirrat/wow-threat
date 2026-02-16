/**
 * Top action controls for threat chart interactions.
 */
import type { FC } from 'react'

export interface ThreatChartControlsProps {
  showClearIsolate: boolean
  onResetZoom: () => void
  onClearIsolate: () => void
}

export const ThreatChartControls: FC<ThreatChartControlsProps> = ({
  showClearIsolate,
  onResetZoom,
  onClearIsolate,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="rounded-md border border-border bg-panel px-2 py-1 text-xs"
        type="button"
        onClick={onResetZoom}
      >
        Reset zoom
      </button>
      {showClearIsolate ? (
        <button
          className="rounded-md border border-border bg-panel px-2 py-1 text-xs"
          type="button"
          onClick={onClearIsolate}
        >
          Clear isolate
        </button>
      ) : null}
    </div>
  )
}
