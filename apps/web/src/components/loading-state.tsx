/**
 * Simple loading panel used across pages.
 */
import type { FC } from 'react'

import { Card, CardContent } from './ui/card'

export type LoadingStateProps = {
  message: string
}

export const LoadingState: FC<LoadingStateProps> = ({ message }) => {
  return (
    <Card aria-live="polite" className="shadow-sm" role="status">
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
