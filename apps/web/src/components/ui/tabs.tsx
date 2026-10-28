/**
 * Tabs primitives built on Radix, styled for the compact app rail.
 */
import { Tabs as TabsPrimitive } from 'radix-ui'
import type * as React from 'react'

import { cn } from '../../lib/utils'

function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex gap-1 border-b border-border px-2', className)}
      data-slot="tabs-list"
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px cursor-pointer border-b-2 border-transparent px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground',
        className,
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('min-h-0 flex-1 overflow-y-auto', className)}
      data-slot="tabs-content"
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
