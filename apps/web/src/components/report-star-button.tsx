/**
 * Reusable star toggle button for report entries.
 */
import { Star } from 'lucide-react'
import type { FC } from 'react'

import { cn } from '../lib/utils'
import { Button } from './ui/button'

export interface ReportStarButtonProps {
  isStarred: boolean
  isDisabled?: boolean
  onToggle: () => void
  ariaLabel: string
  className?: string
  size?: 'icon-xs' | 'icon-sm'
}

/** Render an outlined/filled star button for report favorite toggling. */
export const ReportStarButton: FC<ReportStarButtonProps> = ({
  isStarred,
  isDisabled = false,
  onToggle,
  ariaLabel,
  className,
  size = 'icon-sm',
}) => {
  return (
    <Button
      aria-label={ariaLabel}
      className={cn(
        'text-muted-foreground hover:text-foreground',
        isStarred ? 'text-amber-400 hover:text-amber-300' : undefined,
        className,
      )}
      disabled={isDisabled}
      size={size}
      type="button"
      variant="ghost"
      onClick={onToggle}
    >
      <Star
        aria-hidden="true"
        className={cn('size-4', isStarred ? 'fill-current' : undefined)}
      />
    </Button>
  )
}
