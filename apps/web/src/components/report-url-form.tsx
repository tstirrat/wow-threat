/**
 * Input form for loading a report from URL or report code.
 */
import { useId, useState, type FC } from 'react'

export type ReportUrlFormProps = {
  onSubmit: (input: string) => void
}

export const ReportUrlForm: FC<ReportUrlFormProps> = ({
  onSubmit,
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
        <label className="block text-sm font-medium" htmlFor={inputId}>
          Report URL or ID
        </label>
        <input
          className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm"
          id={inputId}
          name="report-input"
          placeholder="Paste Warcraft Logs report URL or report ID"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <button
        className="rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        type="submit"
      >
        Load report
      </button>
    </form>
  )
}
