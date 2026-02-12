/**
 * Explicit target selector control for fight charts.
 */
import { useId, type FC } from 'react'

import type { ReportActorSummary } from '../types/api'

export type TargetSelectorProps = {
  enemies: ReportActorSummary[]
  selectedTargetId: number
  onChange: (targetId: number) => void
}

export const TargetSelector: FC<TargetSelectorProps> = ({
  enemies,
  selectedTargetId,
  onChange,
}) => {
  const selectId = useId()

  return (
    <label className="flex items-center gap-2 text-sm" htmlFor={selectId}>
      <span className="font-medium">Target</span>
      <select
        className="rounded-md border border-border bg-panel px-3 py-2"
        id={selectId}
        value={selectedTargetId}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {enemies.map((enemy) => (
          <option key={enemy.id} value={enemy.id}>
            {enemy.name} ({enemy.id})
          </option>
        ))}
      </select>
    </label>
  )
}
