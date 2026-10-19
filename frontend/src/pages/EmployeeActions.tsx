import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  SAVE_FAILED,
  readFailure,
  type ApiFailure,
  type AvailabilityStatus,
  type EmployeeDetail,
  type EmployeeStatusChange,
} from '../api/employees'
import Button from '../components/Button'
import Dialog from '../components/Dialog'
import SelectField, { type SelectOption } from '../components/SelectField'
import TextField from '../components/TextField'
import { WarningIcon } from '../components/icons'
import { apiFetch } from '../api/client'

// T#39, BRIEF §6.4 item 5 and "상태 변경" (D6, D21, D33): the HR manager's buttons under the detail and the status
// change dialog. Below 1024px the buttons are hidden (D29, EmployeeDetail.css).
const STATUS_OPTIONS: SelectOption[] = [
  { value: 'AVAILABLE', label: '투입 가능' },
  { value: 'UNAVAILABLE', label: '투입 불가' },
]

type StatusError = { field: 'status' | 'reason' | 'form'; message: string }

// Where a failed status change is shown (contract "상태 변경 대화상자": 오류).
function placeStatusError(failure: ApiFailure): StatusError {
  if (failure.status === 400 && failure.code === 'EMPLOYEE_REASON_REQUIRED' && failure.message) {
    return { field: 'reason', message: failure.message }
  }
  if (failure.status === 400 && failure.code === 'EMPLOYEE_STATUS_INVALID' && failure.message) {
    return { field: 'status', message: failure.message }
  }
  return { field: 'form', message: failure.message ?? SAVE_FAILED }
}

type StatusDialogProps = {
  employee: EmployeeDetail
  onClose: () => void
  onSaved: (employee: EmployeeDetail) => void
}

function StatusDialog({ employee, onClose, onSaved }: StatusDialogProps) {
  const [status, setStatus] = useState<AvailabilityStatus>(employee.availabilityStatus)
  const [reason, setReason] = useState(employee.unavailableReason ?? '')
  const [until, setUntil] = useState(employee.unavailableUntil ?? '')
  const [error, setError] = useState<StatusError | null>(null)
  const [saving, setSaving] = useState(false)
  // One request at a time, however often 저장 or Enter is pressed while it is under way.
  const inFlight = useRef(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    setSaving(true)
    setError(null)
    const body: EmployeeStatusChange =
      status === 'UNAVAILABLE'
        ? { availabilityStatus: 'UNAVAILABLE', unavailableReason: reason.trim(), unavailableUntil: until || null }
        : { availabilityStatus: 'AVAILABLE', unavailableReason: null, unavailableUntil: null }
    try {
      const response = await apiFetch(`/api/employees/${employee.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (response.ok) {
        // The answer is the detail the server read again after saving (D36): it replaces the one on the screen.
        onSaved((await response.json()) as EmployeeDetail)
        return
      }
      setError(placeStatusError(await readFailure(response)))
    } catch {
      setError({ field: 'form', message: SAVE_FAILED })
    }
    inFlight.current = false
    setSaving(false)
  }

  return (
    <Dialog title="상태 변경" onClose={onClose} closable={!saving}>
      <form className="status-dialog" noValidate onSubmit={save}>
        <SelectField
          label="상태"
          required
          options={STATUS_OPTIONS}
          value={status}
          onChange={(value) => setStatus(value as AvailabilityStatus)}
          error={error?.field === 'status' ? error.message : undefined}
        />
        {status === 'UNAVAILABLE' ? (
          <>
            <TextField
              label="사유"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={error?.field === 'reason' ? error.message : undefined}
            />
            <TextField label="종료 예정일" type="date" value={until} onChange={(event) => setUntil(event.target.value)} />
          </>
        ) : null}
        {error?.field === 'form' ? (
          <p className="field__error" role="alert">
            <WarningIcon size={16} />
            {error.message}
          </p>
        ) : null}
        <div className="dialog__actions">
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            취소
          </Button>
          <Button type="submit" loading={saving}>
            저장
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

type EmployeeActionsProps = {
  employee: EmployeeDetail
  onChanged: (employee: EmployeeDetail) => void
}

function EmployeeActions({ employee, onChanged }: EmployeeActionsProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const row = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)

  // When the dialog closes (saved, cancelled or Escape), the focus is back on 상태 변경.
  useEffect(() => {
    if (wasOpen.current && !open) {
      row.current?.querySelector<HTMLButtonElement>('[data-action="status"]')?.focus()
    }
    wasOpen.current = open
  }, [open])

  return (
    <>
      <div ref={row} className="employee-actions">
        <Button onClick={() => navigate(`/employees/${employee.id}/edit`)}>수정</Button>
        <Button variant="secondary" data-action="status" onClick={() => setOpen(true)}>
          상태 변경
        </Button>
      </div>
      {open ? (
        <StatusDialog
          employee={employee}
          onClose={() => setOpen(false)}
          onSaved={(saved) => {
            onChanged(saved)
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

export default EmployeeActions
