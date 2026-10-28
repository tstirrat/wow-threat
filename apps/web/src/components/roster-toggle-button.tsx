/**
 * App bar button that shows or hides the fight roster panel.
 */
import { PanelRight, PanelRightClose } from 'lucide-react'
import type { FC } from 'react'

import { Button } from './ui/button'

export type RosterToggleButtonProps = {
  isRosterVisible: boolean
  onToggle: () => void
}

export const RosterToggleButton: FC<RosterToggleButtonProps> = ({
  isRosterVisible,
  onToggle,
}) => {
  const label = isRosterVisible ? 'Hide roster' : 'Show roster'
  const Icon = isRosterVisible ? PanelRightClose : PanelRight

  return (
    <Button
      aria-keyshortcuts="R"
      aria-label={label}
      aria-pressed={isRosterVisible}
      size="icon"
      title={`${label} (R)`}
      type="button"
      variant="ghost"
      onClick={onToggle}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </Button>
  )
}
