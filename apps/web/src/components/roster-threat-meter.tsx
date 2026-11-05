/**
 * Combined roster and threat meter: players ranked by threat at the playhead (or the
 * end of the fight), with TPS, visibility and pin controls, and a player context menu.
 */
import { Eye, EyeOff, Pin, Plus, Shield, SlidersHorizontal } from 'lucide-react'
import { type FC, type ReactNode, useId, useState } from 'react'

import {
  formatCompactNumber,
  formatNumber,
  formatTimelineTime,
} from '../lib/format'
import {
  ROSTER_TOP_COUNT,
  ROSTER_TPS_WINDOW_MS,
  type RosterShowPreset,
  type RosterThreatRow,
  buildRosterThreatRows,
  resolveRosterPresetIds,
  resolveRosterShowPreset,
} from '../lib/roster-threat'
import type { ThreatSeries } from '../types/app'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

const NO_THREAT_OVERRIDE_ACTOR_IDS = new Set<number>()

export interface RosterThreatMeterProps {
  series: ThreatSeries[]
  /** Playhead time; null lists final threat at the end of the fight. */
  playheadMs: number | null
  focusedActorId: number | null
  isActorVisible: (actorId: number) => boolean
  onActorFocus: (actorId: number) => void
  onActorIsolate: (actorId: number) => void
  /** Show exactly these actors and hide the rest. */
  onSetVisibleActors: (actorIds: number[]) => void
  onToggleActorVisibility: (actorId: number) => void
  onOpenPlayerOverrides: (playerId: number) => void
  onClearPlayerOverrides: (playerId: number) => void
  pinnedPlayerIds: number[]
  onTogglePinnedPlayer: (playerId: number) => void
  showRawThreat: boolean
  showPets: boolean
  onShowPetsChange: (showPets: boolean) => void
  actorIdsWithThreatOverrides?: ReadonlySet<number>
}

type RosterIconButtonProps = {
  label: string
  tooltip: string
  className?: string
  pressed?: boolean
  onClick: () => void
  children: ReactNode
}

/** Icon-only row control with a tooltip. */
const RosterIconButton: FC<RosterIconButtonProps> = ({
  label,
  tooltip,
  className = '',
  pressed,
  onClick,
  children,
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        aria-label={label}
        aria-pressed={pressed}
        className={`h-6 w-6 shrink-0 cursor-pointer ${className}`}
        size="icon-xs"
        type="button"
        variant="ghost"
        onClick={onClick}
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent className="pointer-events-none" side="top">
      {tooltip}
    </TooltipContent>
  </Tooltip>
)

type RosterRowProps = {
  row: RosterThreatRow
  maxThreat: number
  showRawThreat: boolean
  isFocused: boolean
  isVisible: boolean
  isPinned: boolean
  hasThreatOverrides: boolean
  onFocus: () => void
  onIsolate: () => void
  onToggleVisibility: () => void
  onTogglePin: () => void
  onOpenOverrides: () => void
  onClearOverrides: () => void
}

/** One ranked player row with a class-coloured threat bar. */
const RosterRow: FC<RosterRowProps> = ({
  row,
  maxThreat,
  showRawThreat,
  isFocused,
  isVisible,
  isPinned,
  hasThreatOverrides,
  onFocus,
  onIsolate,
  onToggleVisibility,
  onTogglePin,
  onOpenOverrides,
  onClearOverrides,
}) => {
  const { series: item, threat, tps } = row
  const label = item.label
  const isPlayer = item.actorType === 'Player'
  const isTank = isPlayer && item.actorRole === 'Tank'
  const isHealer = isPlayer && item.actorRole === 'Healer'
  const widthPercent = maxThreat > 0 ? (threat / maxThreat) * 100 : 0

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={`group flex min-w-0 items-center gap-0.5 px-1 ${
              isVisible ? '' : 'opacity-50'
            }`}
            data-focused={isFocused}
          >
            <RosterIconButton
              label={`Toggle ${label}`}
              pressed={isVisible}
              tooltip={isVisible ? `Hide line (H)` : `Show line (H)`}
              onClick={onToggleVisibility}
            >
              {isVisible ? <Eye /> : <EyeOff />}
            </RosterIconButton>
            <div
              className={`relative flex h-6 min-w-0 flex-1 items-center overflow-hidden rounded-sm border ${
                isFocused ? 'border-foreground/70' : 'border-transparent'
              }`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-sm"
                data-testid="roster-bar"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: item.color,
                  opacity: 0.3,
                }}
              />
              {/* Full-row click target; the content layer above lets clicks fall through to it. */}
              <button
                aria-label={`Focus ${label}`}
                className="absolute inset-0 cursor-pointer rounded-sm"
                title="Click to focus. Double-click to show only this player."
                type="button"
                onClick={onFocus}
                onDoubleClick={onIsolate}
              />
              <div className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-1 px-1">
                <span
                  className="min-w-0 truncate text-xs font-medium"
                  data-testid="roster-name"
                  style={{ color: item.color }}
                >
                  {label}
                </span>
                {isTank ? (
                  <Shield
                    aria-label="Tank role"
                    className="h-3 w-3 shrink-0 text-amber-500"
                  />
                ) : null}
                {isHealer ? (
                  <Plus aria-label="Healer role" className="h-3 w-3 shrink-0" />
                ) : null}
                {hasThreatOverrides ? (
                  <RosterIconButton
                    className="pointer-events-auto h-5 w-5 text-muted-foreground"
                    label={`Threat overrides for ${label}`}
                    tooltip={`Threat overrides for ${label}`}
                    onClick={onOpenOverrides}
                  >
                    <SlidersHorizontal />
                  </RosterIconButton>
                ) : null}
                {isPlayer ? (
                  <RosterIconButton
                    className={`pointer-events-auto h-5 w-5 ${
                      isPinned
                        ? 'text-amber-500'
                        : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                    }`}
                    label={`Toggle pin ${label}`}
                    pressed={isPinned}
                    tooltip={isPinned ? 'Unpin (P)' : 'Pin across fights (P)'}
                    onClick={onTogglePin}
                  >
                    <Pin />
                  </RosterIconButton>
                ) : null}
                <span className="min-w-0 flex-1" />
                <span
                  className="w-14 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums"
                  data-testid="roster-tps"
                >
                  {formatNumber(tps)}
                </span>
                <span
                  className="w-14 shrink-0 text-right text-[11px] tabular-nums"
                  data-testid="roster-threat"
                >
                  {showRawThreat
                    ? formatNumber(threat)
                    : formatCompactNumber(threat)}
                </span>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>{label}</ContextMenuLabel>
          <ContextMenuItem onSelect={onFocus}>Focus</ContextMenuItem>
          <ContextMenuItem onSelect={onIsolate}>
            Show only this player
          </ContextMenuItem>
          <ContextMenuItem onSelect={onToggleVisibility}>
            {isVisible ? 'Hide line' : 'Show line'}
          </ContextMenuItem>
          {isPlayer ? (
            <>
              <ContextMenuItem onSelect={onTogglePin}>
                {isPinned ? 'Unpin' : 'Pin across fights'}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={onOpenOverrides}>
                Override buffs and talents…
              </ContextMenuItem>
              {hasThreatOverrides ? (
                <ContextMenuItem onSelect={onClearOverrides}>
                  Clear overrides
                </ContextMenuItem>
              ) : null}
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    </li>
  )
}

type RosterControlsProps = {
  activePreset: RosterShowPreset
  filter: string
  onFilterChange: (filter: string) => void
  onSetVisibleActors: (actorIds: number[]) => void
  presetIds: ReturnType<typeof resolveRosterPresetIds>
}

/** Player filter box plus All / Tanks / Top 5 visibility presets. */
const RosterControls: FC<RosterControlsProps> = ({
  activePreset,
  filter,
  onFilterChange,
  onSetVisibleActors,
  presetIds,
}) => (
  <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
    <Input
      aria-label="Filter players"
      className="h-6 min-w-0 flex-1 text-xs"
      placeholder="Filter players"
      type="search"
      value={filter}
      onChange={(event) => {
        onFilterChange(event.target.value)
      }}
      onKeyDown={(event) => {
        // Release focus so page shortcuts (Space, H, P…) work again.
        if (event.key === 'Escape') {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
    />
    <div
      aria-label="Show players"
      className="flex shrink-0 gap-0.5"
      role="group"
    >
      <Button
        aria-pressed={activePreset === 'all'}
        className="cursor-pointer"
        size="xs"
        title={activePreset === 'all' ? 'Hide everyone' : 'Show everyone'}
        type="button"
        variant={activePreset === 'all' ? 'secondary' : 'ghost'}
        onClick={() => {
          onSetVisibleActors(activePreset === 'all' ? [] : presetIds.all)
        }}
      >
        All
      </Button>
      <Button
        aria-pressed={activePreset === 'tanks'}
        className="cursor-pointer"
        size="xs"
        type="button"
        variant={activePreset === 'tanks' ? 'secondary' : 'ghost'}
        onClick={() => {
          onSetVisibleActors(presetIds.tanks)
        }}
      >
        Tanks
      </Button>
      <Button
        aria-pressed={activePreset === 'top'}
        className="cursor-pointer"
        size="xs"
        title="Top five by threat at the shown time"
        type="button"
        variant={activePreset === 'top' ? 'secondary' : 'ghost'}
        onClick={() => {
          onSetVisibleActors(presetIds.top)
        }}
      >
        Top {ROSTER_TOP_COUNT}
      </Button>
    </div>
  </div>
)

export const RosterThreatMeter: FC<RosterThreatMeterProps> = ({
  series,
  playheadMs,
  focusedActorId,
  isActorVisible,
  onActorFocus,
  onActorIsolate,
  onSetVisibleActors,
  onToggleActorVisibility,
  onOpenPlayerOverrides,
  onClearPlayerOverrides,
  pinnedPlayerIds,
  onTogglePinnedPlayer,
  showRawThreat,
  showPets,
  onShowPetsChange,
  actorIdsWithThreatOverrides = NO_THREAT_OVERRIDE_ACTOR_IDS,
}) => {
  const showPetsId = useId()
  const [filter, setFilter] = useState('')
  const pinnedPlayerIdSet = new Set(pinnedPlayerIds)
  const rows = buildRosterThreatRows(series, playheadMs)
  const maxThreat = rows[0]?.threat ?? 0
  const normalizedFilter = filter.trim().toLowerCase()
  const listedRows = normalizedFilter
    ? rows.filter((row) =>
        row.series.label.toLowerCase().includes(normalizedFilter),
      )
    : rows
  const presetIds = resolveRosterPresetIds(rows)
  const activePreset = resolveRosterShowPreset(rows, isActorVisible)
  const tpsSeconds = ROSTER_TPS_WINDOW_MS / 1000

  return (
    <section
      aria-label="Roster"
      className="flex min-h-0 max-h-[560px] flex-col text-xs/relaxed text-card-foreground lg:h-full lg:max-h-none"
      data-testid="threat-meter"
    >
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <h2 className="text-xs font-medium">
          Roster
          <span className="ml-2 font-normal text-muted-foreground">
            {playheadMs === null
              ? 'End of fight'
              : formatTimelineTime(playheadMs)}
          </span>
        </h2>
      </div>
      <RosterControls
        activePreset={activePreset}
        filter={filter}
        onFilterChange={setFilter}
        onSetVisibleActors={onSetVisibleActors}
        presetIds={presetIds}
      />
      <div
        aria-hidden="true"
        className="flex shrink-0 items-center gap-0.5 border-b border-border py-1 pr-[calc(0.5rem+0.25rem+1px)] pl-1 text-[11px] [scrollbar-gutter:stable] text-muted-foreground"
      >
        <span className="w-6 shrink-0" />
        <span className="min-w-0 flex-1 px-1">Player</span>
        <span className="w-14 shrink-0 text-right">TPS ({tpsSeconds}s)</span>
        <span className="w-14 shrink-0 text-right">Threat</span>
      </div>
      <TooltipProvider delayDuration={0} disableHoverableContent>
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <ul className="py-1 pr-2 pl-0">
            {listedRows.map((row) => {
              const actorId = row.series.actorId
              const isPlayer = row.series.actorType === 'Player'

              return (
                <RosterRow
                  hasThreatOverrides={
                    isPlayer && actorIdsWithThreatOverrides.has(actorId)
                  }
                  isFocused={actorId === focusedActorId}
                  isPinned={isPlayer && pinnedPlayerIdSet.has(actorId)}
                  isVisible={isActorVisible(actorId)}
                  key={actorId}
                  maxThreat={maxThreat}
                  showRawThreat={showRawThreat}
                  row={row}
                  onClearOverrides={() => {
                    onClearPlayerOverrides(actorId)
                  }}
                  onFocus={() => {
                    onActorFocus(actorId)
                  }}
                  onIsolate={() => {
                    onActorIsolate(actorId)
                  }}
                  onOpenOverrides={() => {
                    onOpenPlayerOverrides(actorId)
                  }}
                  onToggleVisibility={() => {
                    onToggleActorVisibility(actorId)
                  }}
                  onTogglePin={() => {
                    onTogglePinnedPlayer(actorId)
                  }}
                />
              )
            })}
          </ul>
        </div>
      </TooltipProvider>
      <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1 text-[11px] text-muted-foreground">
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
        <span className="inline-flex items-center gap-2">
          <Checkbox
            checked={showPets}
            id={showPetsId}
            onCheckedChange={(checked) => {
              onShowPetsChange(checked === true)
            }}
          />
          <Label className="text-xs text-muted-foreground" htmlFor={showPetsId}>
            Show pets
          </Label>
        </span>
      </div>
    </section>
  )
}
