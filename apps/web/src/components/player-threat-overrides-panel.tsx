/**
 * Side panel for shareable, per-player threat calculation overrides.
 */
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { type FC, type ReactNode } from 'react'

import {
  type ActorThreatOverrides,
  type AuraOverrideState,
  type AuraThreatOverrideOption,
  type TalentThreatOverrideOption,
  type ThreatOverrideOption,
  resolveAuraOptionState,
} from '../lib/threat-overrides'
import type { ReportActorSummary } from '../types/api'
import { PlayerName } from './player-name'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

export interface PlayerThreatOverridesPanelProps {
  actor: ReportActorSummary
  actorColor: string
  actorOverrides: ActorThreatOverrides | undefined
  isRecalculating: boolean
  onAuraOverrideChange: (
    option: AuraThreatOverrideOption,
    state: AuraOverrideState,
  ) => void
  onClose: () => void
  onReset: () => void
  onTalentRankOverrideChange: (
    option: TalentThreatOverrideOption,
    rank: number | null,
  ) => void
  options: ThreatOverrideOption[]
}

function AuraOverrideControl({
  actorOverrides,
  onChange,
  option,
}: {
  actorOverrides: ActorThreatOverrides | undefined
  onChange: (state: AuraOverrideState) => void
  option: AuraThreatOverrideOption
}) {
  const state = resolveAuraOptionState(actorOverrides, option)

  return (
    <OverrideRow label={option.label}>
      <ToggleGroup
        aria-label={`${option.label} override`}
        className="h-6 w-full"
        type="single"
        value={state}
        onValueChange={(value) => {
          if (value === 'auto' || value === 'on' || value === 'off') {
            onChange(value)
          }
        }}
      >
        {(['auto', 'on', 'off'] as const).map((value) => (
          <ToggleGroupItem
            aria-label={`${option.label} ${value}`}
            className="min-w-0 flex-1 px-1 text-[11px]"
            key={value}
            value={value}
          >
            {value === 'auto' ? 'Auto' : value === 'on' ? 'On' : 'Off'}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </OverrideRow>
  )
}

function TalentOverrideControl({
  actorOverrides,
  onChange,
  option,
}: {
  actorOverrides: ActorThreatOverrides | undefined
  onChange: (rank: number | null) => void
  option: TalentThreatOverrideOption
}) {
  const explicitRank = actorOverrides?.talents[String(option.talentEntryId)]
  const value = explicitRank === undefined ? 'auto' : String(explicitRank)

  return (
    <OverrideRow label={option.label}>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          onChange(nextValue === 'auto' ? null : Number.parseInt(nextValue, 10))
        }}
      >
        <SelectTrigger
          aria-label={`${option.label} rank override`}
          className="w-full"
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Auto</SelectItem>
          <SelectItem value="0">Off</SelectItem>
          {Array.from({ length: option.maxRank }, (_, index) => index + 1).map(
            (rank) => (
              <SelectItem key={rank} value={String(rank)}>
                Rank {rank}
              </SelectItem>
            ),
          )}
        </SelectContent>
      </Select>
    </OverrideRow>
  )
}

function OverrideRow({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3 border-b border-border/70 px-3 py-1.5 last:border-b-0">
      <div className="truncate text-xs font-medium text-foreground">
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Right-side sheet for one player's threat overrides; stays open while the chart is used. */
export const PlayerThreatOverridesPanel: FC<
  PlayerThreatOverridesPanelProps
> = ({
  actor,
  actorColor,
  actorOverrides,
  isRecalculating,
  onAuraOverrideChange,
  onClose,
  onReset,
  onTalentRankOverrideChange,
  options,
}) => {
  const hasOverrides = Boolean(
    actorOverrides &&
    (Object.keys(actorOverrides.auras).length > 0 ||
      Object.keys(actorOverrides.talents).length > 0),
  )

  return (
    <Sheet
      modal={false}
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose()
        }
      }}
    >
      <SheetContent
        aria-describedby={undefined}
        className="max-[760px]:w-full max-[760px]:border-l-0"
        closeLabel="Close threat overrides"
        onInteractOutside={(event) => {
          event.preventDefault()
        }}
      >
        <SheetHeader>
          {/* The sheet takes its accessible name from this title, so it names the player. */}
          <SheetTitle
            aria-label={`Threat overrides for ${actor.name}`}
            className="flex items-center gap-2"
          >
            <SlidersHorizontal
              aria-hidden="true"
              className="h-4 w-4 text-muted-foreground"
            />
            Threat overrides
          </SheetTitle>
          <div className="flex min-h-6 items-center gap-2 text-xs">
            <span className="min-w-0 truncate">
              <PlayerName color={actorColor} label={actor.name} />
              {actor.subType ? (
                <span className="text-muted-foreground">{` · ${actor.subType}`}</span>
              ) : null}
            </span>
            {isRecalculating ? (
              <span
                aria-live="polite"
                className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400"
              >
                Updating…
              </span>
            ) : null}
            {hasOverrides ? (
              <Button
                aria-label={`Reset threat overrides for ${actor.name}`}
                className="ml-auto max-[760px]:h-10"
                size="xs"
                type="button"
                variant="ghost"
                onClick={onReset}
              >
                <RotateCcw />
                Reset
              </Button>
            ) : null}
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No overrides available.
            </p>
          ) : (
            options.map((option) =>
              option.kind === 'aura' ? (
                <AuraOverrideControl
                  actorOverrides={actorOverrides}
                  key={option.key}
                  option={option}
                  onChange={(state) => {
                    onAuraOverrideChange(option, state)
                  }}
                />
              ) : (
                <TalentOverrideControl
                  actorOverrides={actorOverrides}
                  key={option.key}
                  option={option}
                  onChange={(rank) => {
                    onTalentRankOverrideChange(option, rank)
                  }}
                />
              ),
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
