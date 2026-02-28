import { cn } from '@/lib/utils'
import { Popover as PopoverPrimitive } from 'radix-ui'
import * as React from 'react'

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

function PopoverContent({
  className,
  sideOffset = 4,
  align = 'start',
  withPortal = true,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  withPortal?: boolean
}) {
  const content = (
    <PopoverPrimitive.Content
      align={align}
      className={cn(
        'bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 rounded-md border border-border p-1 shadow-md ring-1',
        className,
      )}
      data-slot="popover-content"
      sideOffset={sideOffset}
      {...props}
    />
  )

  if (!withPortal) {
    return content
  }

  return <PopoverPrimitive.Portal>{content}</PopoverPrimitive.Portal>
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger }
