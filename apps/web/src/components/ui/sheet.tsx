import { cn } from '@/lib/utils'
import { XIcon } from 'lucide-react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import * as React from 'react'

import { Button } from './button'

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      className={cn('fixed inset-0 z-50 bg-black/50', className)}
      data-slot="sheet-overlay"
      {...props}
    />
  )
}

function SheetContent({
  children,
  className,
  closeLabel = 'Close',
  side = 'right',
  withOverlay = false,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  closeLabel?: string
  side?: 'left' | 'right'
  withOverlay?: boolean
}) {
  return (
    <SheetPrimitive.Portal>
      {withOverlay ? <SheetOverlay /> : null}
      <SheetPrimitive.Content
        className={cn(
          'bg-popover text-popover-foreground fixed inset-y-0 z-50 flex w-[min(22rem,100vw)] flex-col border-border shadow-2xl outline-none',
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
          className,
        )}
        data-slot="sheet-content"
        {...props}
      >
        {children}
        <SheetPrimitive.Close asChild>
          <Button
            aria-label={closeLabel}
            className="absolute right-2 top-2 max-[760px]:size-10"
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <XIcon />
          </Button>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 border-b border-border p-3 pr-12',
        className,
      )}
      data-slot="sheet-header"
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn('text-sm font-semibold', className)}
      data-slot="sheet-title"
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn('text-xs text-muted-foreground', className)}
      data-slot="sheet-description"
      {...props}
    />
  )
}

export {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
}
