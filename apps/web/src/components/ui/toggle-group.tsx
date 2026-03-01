/**
 * Styled Radix toggle-group primitives used for segmented controls.
 */
import { cn } from '@/lib/utils'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import * as React from 'react'

function ToggleGroup({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & {
  variant?: 'default' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-size={size}
      data-variant={variant}
      className={cn(
        'group/toggle-group inline-flex items-stretch overflow-hidden rounded-md border border-input bg-transparent',
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant = 'default',
  size = 'default',
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & {
  variant?: 'default' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-size={size}
      data-variant={variant}
      className={cn(
        'inline-flex min-w-14 items-center justify-center border-l border-input bg-transparent px-2.5 text-xs font-medium text-foreground/70 transition-all first:border-l-0 hover:bg-accent hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

export { ToggleGroup, ToggleGroupItem }
