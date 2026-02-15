/**
 * Shared section wrapper for neutral card-like layout blocks.
 */
import { type FC, type PropsWithChildren, type ReactNode, useId } from 'react'

export type SectionCardProps = PropsWithChildren<{
  title: string
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
    <section
      aria-labelledby={sectionTitleId}
      className="rounded-xl border border-border bg-panel p-4 shadow-sm"
    >
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold" id={sectionTitleId}>
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          ) : null}
        </div>
        {headerRight ? (
          <div className="shrink-0 sm:ml-4 sm:self-end">{headerRight}</div>
        ) : null}
      </header>
      {children}
    </section>
  )
}
