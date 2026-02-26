/**
 * Input form for loading a report from URL or report code.
 */
import { Search } from 'lucide-react'
import { type FC, type Ref, useId, useState } from 'react'

import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export type ReportUrlFormProps = {
  onSubmit: (input: string) => void
  isSubmitting?: boolean
  label?: string
  placeholder?: string
  submitLabel?: string
  submitIconOnly?: boolean
  inputRef?: Ref<HTMLInputElement>
  className?: string
}

export const ReportUrlForm: FC<ReportUrlFormProps> = ({
  onSubmit,
  isSubmitting = false,
  label = 'Report URL or ID',
  placeholder = 'Paste Warcraft Logs report URL or report ID',
  submitLabel = 'Load report',
  submitIconOnly = false,
  inputRef,
  className,
}) => {
  const [value, setValue] = useState('')
  const inputId = useId()

  return (
    <form
      aria-label="Load Warcraft Logs report"
      className={
        className ?? 'flex flex-col gap-3 sm:flex-row sm:items-end'
      }
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(value)
      }}
    >
      <div className="w-full space-y-1">
        <Label className="text-sm" htmlFor={inputId}>
          {label}
        </Label>
        <Input
          disabled={isSubmitting}
          id={inputId}
          name="report-input"
          placeholder={placeholder}
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
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
