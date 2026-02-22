/**
 * Input form for loading a report from URL or report code.
 */
import { type FC, useId, useState } from 'react'

import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export type ReportUrlFormProps = {
  onSubmit: (input: string) => void
  isSubmitting?: boolean
}

export const ReportUrlForm: FC<ReportUrlFormProps> = ({
  onSubmit,
  isSubmitting = false,
}) => {
  const [value, setValue] = useState('')
  const inputId = useId()

  return (
    <form
      aria-label="Load Warcraft Logs report"
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(value)
      }}
    >
      <div className="w-full space-y-1">
        <Label className="text-sm" htmlFor={inputId}>
          Report URL or ID
        </Label>
        <Input
          disabled={isSubmitting}
          id={inputId}
          name="report-input"
          placeholder="Paste Warcraft Logs report URL or report ID"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <Button className="sm:self-end" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Loading...' : 'Load report'}
      </Button>
    </form>
  )
}
