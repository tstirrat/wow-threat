/**
 * Input form for loading a report from URL or report code.
 */
import { Search } from 'lucide-react'
import { type FC, type Ref, useState } from 'react'

import { Button } from './ui/button'
import { Input } from './ui/input'

export type ReportUrlFormProps = {
  onSubmit: (input: string) => void
  onInputEscape?: () => void
  onInputBlur?: () => void
  isSubmitting?: boolean
  inputAriaLabel?: string
  placeholder?: string
  submitLabel?: string
  submitIconOnly?: boolean
  inputRef?: Ref<HTMLInputElement>
  className?: string
}

export const ReportUrlForm: FC<ReportUrlFormProps> = ({
  onSubmit,
  onInputEscape,
  onInputBlur,
  isSubmitting = false,
  inputAriaLabel = 'Report URL or ID',
  placeholder = 'Paste Warcraft Logs report URL or report ID',
  submitLabel = 'Load report',
  submitIconOnly = false,
  inputRef,
  className,
}) => {
  const [value, setValue] = useState('')

  return (
    <form
      aria-label="Load Warcraft Logs report"
      className={className ?? 'flex flex-col gap-3 sm:flex-row sm:items-end'}
      onBlur={(event) => {
        const nextFocusedElement = event.relatedTarget
        if (
          nextFocusedElement &&
          event.currentTarget.contains(nextFocusedElement)
        ) {
          return
        }
        onInputBlur?.()
      }}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(value)
      }}
    >
      <div className="w-full">
        <Input
          aria-label={inputAriaLabel}
          disabled={isSubmitting}
          name="report-input"
          placeholder={placeholder}
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.blur()
              onInputEscape?.()
            }
          }}
        />
      </div>
      <Button
        aria-label={submitLabel}
        className="sm:self-end"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          'Loading...'
        ) : submitIconOnly ? (
          <Search aria-hidden="true" className="size-4" />
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  )
}
