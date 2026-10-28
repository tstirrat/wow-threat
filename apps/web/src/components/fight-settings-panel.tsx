/**
 * Settings side panel for chart display and analysis toggles, plus its app bar gear button.
 */
import { Info, Settings } from 'lucide-react'
import { type FC, type ReactNode, type RefObject, useId } from 'react'

import type { BossDamageMode } from '../types/app'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Kbd } from './ui/kbd'
import { Label } from './ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

export interface FightSettingsPanelProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  triggerRef: RefObject<HTMLButtonElement | null>
  showFixateBands: boolean
  onShowFixateBandsChange: (showFixateBands: boolean) => void
  showEnergizeEvents: boolean
  onShowEnergizeEventsChange: (showEnergizeEvents: boolean) => void
  showPets: boolean
  onShowPetsChange: (showPets: boolean) => void
  bossDamageMode: BossDamageMode
  onBossDamageModeChange: (bossDamageMode: BossDamageMode) => void
  inferThreatReduction: boolean
  onInferThreatReductionChange: (inferThreatReduction: boolean) => void
}

export interface FightSettingsButtonProps {
  onOpen: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
}

/** Gear button for the app bar settings slot. */
export const FightSettingsButton: FC<FightSettingsButtonProps> = ({
  onOpen,
  triggerRef,
}) => (
  <Button
    aria-label="Settings"
    ref={triggerRef}
    size="icon-sm"
    title="Settings (,)"
    type="button"
    variant="outline"
    onClick={onOpen}
  >
    <Settings />
  </Button>
)

const SettingsGroup: FC<{
  title: string
  hint: string
  children: ReactNode
}> = ({ children, hint, title }) => (
  <section className="flex flex-col gap-2 border-b border-border px-3 py-3 last:border-b-0">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </h3>
    <p className="text-xs text-muted-foreground">{hint}</p>
    {children}
  </section>
)

const CheckboxRow: FC<{
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children?: ReactNode
}> = ({ checked, children, label, onCheckedChange }) => {
  const id = useId()

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        id={id}
        onCheckedChange={(next) => {
          onCheckedChange(next === true)
        }}
      />
      <Label className="cursor-pointer text-sm" htmlFor={id}>
        {label}
      </Label>
      {children}
    </div>
  )
}

const BossDamageRow: FC<{
  mode: BossDamageMode
  onChange: (mode: BossDamageMode) => void
}> = ({ mode, onChange }) => {
  const labelId = useId()

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="inline-flex items-center gap-1 text-sm">
        <span id={labelId}>Boss damage</span>
        <Kbd aria-hidden="true">B</Kbd>
      </Label>
      <ToggleGroup
        aria-labelledby={labelId}
        type="single"
        value={mode}
        variant="outline"
        onValueChange={(value) => {
          if (value === 'off' || value === 'melee' || value === 'all') {
            onChange(value)
          }
        }}
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
  )
}

const InferThreatReductionHelp: FC = () => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label="Infer common threat buffs help"
          className="h-6 w-6"
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Info className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <ul className="list-disc pl-4">
          <li>
            Infers Salvation for non-tank players when a Paladin is present in
            the fight
          </li>
          <li>Infers Righteous Fury on Paladin tanks</li>
          <li>Attempts to emulate Tranquil Air Totem if dropped</li>
        </ul>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

export const FightSettingsPanel: FC<FightSettingsPanelProps> = ({
  bossDamageMode,
  inferThreatReduction,
  isOpen,
  onBossDamageModeChange,
  onInferThreatReductionChange,
  onOpenChange,
  onShowEnergizeEventsChange,
  onShowFixateBandsChange,
  onShowPetsChange,
  showEnergizeEvents,
  showFixateBands,
  showPets,
  triggerRef,
}) => (
  <Sheet modal={false} open={isOpen} onOpenChange={onOpenChange}>
    <SheetContent
      aria-label="Settings"
      className="max-[760px]:w-full max-[760px]:border-l-0"
      closeLabel="Close settings"
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        triggerRef.current?.focus()
      }}
      onInteractOutside={(event) => {
        event.preventDefault()
      }}
    >
      <SheetHeader>
        <SheetTitle>Settings</SheetTitle>
        <SheetDescription>Chart display and analysis options.</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SettingsGroup hint="Saved in this browser." title="My display">
          <BossDamageRow
            mode={bossDamageMode}
            onChange={onBossDamageModeChange}
          />
          <CheckboxRow
            checked={showFixateBands}
            label="Show fixate areas"
            onCheckedChange={onShowFixateBandsChange}
          />
          <CheckboxRow
            checked={showEnergizeEvents}
            label="Show energize events"
            onCheckedChange={onShowEnergizeEventsChange}
          />
          <CheckboxRow
            checked={showPets}
            label="Show pets"
            onCheckedChange={onShowPetsChange}
          />
        </SettingsGroup>
        <SettingsGroup hint="Changes the threat numbers." title="This analysis">
          <CheckboxRow
            checked={inferThreatReduction}
            label="Infer common threat buffs"
            onCheckedChange={onInferThreatReductionChange}
          >
            <InferThreatReductionHelp />
          </CheckboxRow>
        </SettingsGroup>
      </div>
    </SheetContent>
  </Sheet>
)
