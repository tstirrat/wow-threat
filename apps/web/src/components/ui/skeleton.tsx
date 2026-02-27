/**
 * ShadCN skeleton placeholder primitive.
 */
import type { FC, HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

export type SkeletonProps = HTMLAttributes<HTMLDivElement>

export const Skeleton: FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}
