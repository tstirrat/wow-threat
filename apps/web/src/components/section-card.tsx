/**
 * Shared section wrapper for neutral card-like layout blocks.
 */
import { type FC, type PropsWithChildren, type ReactNode, useId } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'

export type SectionCardProps = PropsWithChildren<{
  title: ReactNode
  subtitle?: string
  headerRight?: ReactNode
}>

export const SectionCard: FC<SectionCardProps> = ({
  title,
  subtitle,
  headerRight,
  children,
}) => {
  const sectionTitleId = useId()

  return (
    <section aria-labelledby={sectionTitleId}>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle id={sectionTitleId}>{title}</CardTitle>
            {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
          </div>
          {headerRight ? (
            <div className="shrink-0 sm:ml-4 sm:self-end">{headerRight}</div>
          ) : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  )
}
