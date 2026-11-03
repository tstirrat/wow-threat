/**
 * Modal dialog that takes a Warcraft Logs report URL or code and opens it.
 */
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type FC, type FormEvent, useState } from 'react'

interface OpenReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Returns an error message to show in the dialog, or null once the report opened. */
  onSubmit: (input: string) => string | null
  /** Called after close so focus can return to the trigger button. */
  onCloseAutoFocus?: (event: Event) => void
}

interface OpenReportFormProps {
  onCancel: () => void
  onOpened: () => void
  onSubmit: (input: string) => string | null
}

/** Form body; it mounts with the dialog content, so its state starts empty on each open. */
const OpenReportForm: FC<OpenReportFormProps> = ({
  onCancel,
  onOpened,
  onSubmit,
}) => {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault()
    const message = onSubmit(value)
    setError(message)
    if (!message) {
      onOpened()
    }
  }

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-3"
      data-testid="open-report-form"
      onSubmit={handleSubmit}
    >
      <DialogHeader>
        <DialogTitle>Open a report</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        <Label className="max-[760px]:text-sm" htmlFor="open-report-input">
          Warcraft Logs report URL or code
        </Label>
        <Input
          aria-describedby={error ? 'open-report-error' : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          autoFocus
          className="max-[760px]:h-10 max-[760px]:text-sm"
          id="open-report-input"
          placeholder="https://fresh.warcraftlogs.com/reports/…"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
          }}
        />
        {error ? (
          <p
            className="text-xs break-words text-destructive max-[760px]:text-sm"
            id="open-report-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button
          className="max-[760px]:h-10 max-[760px]:px-4"
          type="button"
          variant="ghost"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button className="max-[760px]:h-10 max-[760px]:px-4" type="submit">
          Open
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Plain modal with one input, an inline error and Cancel/Open buttons. */
export const OpenReportDialog: FC<OpenReportDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
  onCloseAutoFocus,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      aria-describedby={undefined}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <OpenReportForm
        onCancel={() => {
          onOpenChange(false)
        }}
        onOpened={() => {
          onOpenChange(false)
        }}
        onSubmit={onSubmit}
      />
    </DialogContent>
  </Dialog>
)
