/**
 * Explicit target selector for fight charts, styled as the last app bar breadcrumb.
 */
import { type FC, useId } from 'react'

import type { FightTarget, FightTargetOption } from '../types/app'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './ui/select'

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
  const bossTargets = targets.filter((target) => target.isBoss)
  const nonBossTargets = targets.filter((target) => !target.isBoss)

  return (
    <div className="flex min-w-0 items-center text-sm">
      <Label className="sr-only" htmlFor={selectId}>
        Target
      </Label>
      <Select
        value={selectedValue}
        onValueChange={(value) => {
          const [idRaw, instanceRaw] = value.split(':')
          onChange({
            id: Number(idRaw),
            instance: Number(instanceRaw),
          })
        }}
      >
        <SelectTrigger
          className="h-8 min-w-0 max-w-full border-0 bg-transparent px-1 text-sm font-medium text-foreground shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted"
          id={selectId}
        >
          <span className="font-normal text-muted-foreground">vs</span>
          <SelectValue placeholder="Select target" />
        </SelectTrigger>
        <SelectContent>
          {bossTargets.map((target) => (
            <SelectItem key={target.key} value={target.key}>
              {target.label}
            </SelectItem>
          ))}
          {bossTargets.length > 0 && nonBossTargets.length > 0 ? (
            <SelectSeparator />
          ) : null}
          {nonBossTargets.map((target) => (
            <SelectItem key={target.key} value={target.key}>
              {target.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
