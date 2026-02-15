/**
 * Explicit target selector control for fight charts.
 */
import { type FC, useId } from 'react'

import type { FightTarget, FightTargetOption } from '../types/app'

export type TargetSelectorProps = {
  targets: FightTargetOption[]
  selectedTarget: FightTarget
  onChange: (target: FightTarget) => void
}

export const TargetSelector: FC<TargetSelectorProps> = ({
  targets,
  selectedTarget,
  onChange,
}) => {
  const selectId = useId()
  const selectedValue = `${selectedTarget.id}:${selectedTarget.instance}`

  return (
    <label className="flex items-center gap-2 text-sm" htmlFor={selectId}>
      <span className="font-medium">Target</span>
      <select
        className="rounded-md border border-border bg-panel px-3 py-2"
        id={selectId}
        value={selectedValue}
        onChange={(event) => {
          const [idRaw, instanceRaw] = event.target.value.split(':')
          onChange({
            id: Number(idRaw),
            instance: Number(instanceRaw),
          })
        }}
      >
        {targets.map((target) => (
          <option key={target.key} value={target.key}>
            {target.label}
          </option>
        ))}
      </select>
    </label>
  )
}
