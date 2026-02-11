/**
 * Explicit target selector control for fight charts.
 */
import type { ReportActorSummary } from '../types/api'

export function TargetSelector({
  enemies,
  selectedTargetId,
  onChange,
}: {
  enemies: ReportActorSummary[]
  selectedTargetId: number
  onChange: (targetId: number) => void
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Target</span>
      <select
        className="rounded-md border border-border bg-panel px-3 py-2"
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
