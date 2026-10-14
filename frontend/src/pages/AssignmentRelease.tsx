import { useRef, useState } from 'react'
import { sendAssignment } from '../api/assignments'
import type { AssignedEmployee } from '../api/projects'
import Button from '../components/Button'
import Dialog from '../components/Dialog'
import { WarningIcon } from '../components/icons'

// T#17, BRIEF §3.6 "확인 대화상자(배치 해제)" (D28, D29): a dialog on the screen, not the browser's confirm. It names the
// assignment, 취소 closes it without a request, 해제 sends one DELETE; while it is under way Escape does not close it, and a
// failure shows the server's message inside the dialog and leaves it open.
type ReleaseDialogProps = {
  projectName: string
  assignment: AssignedEmployee
  onClose: () => void
  onReleased: () => void
}

function ReleaseDialog({ projectName, assignment, onClose, onReleased }: ReleaseDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // One request at a time, however often 해제 is pressed while it is under way.
  const inFlight = useRef(false)

  async function release() {
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    setBusy(true)
    setError(null)
    const result = await sendAssignment('DELETE', `/api/assignments/${assignment.assignmentId}`)
    if (result.ok) {
      onReleased()
      return
    }
    setError(result.failure.message)
    inFlight.current = false
    setBusy(false)
  }

  return (
    <Dialog title="배치 해제" onClose={onClose} closable={!busy}>
      <p className="assign__release-target">
        {`${assignment.employeeName} · ${projectName} · ${assignment.startDate}\u00a0~ ${assignment.endDate} · ${assignment.allocationPercent}%`}
      </p>
      {error ? (
        <p className="field__error" role="alert">
          <WarningIcon size={16} />
          {error}
        </p>
      ) : null}
      <div className="dialog__actions">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          취소
        </Button>
        <Button variant="danger" loading={busy} onClick={release}>
          해제
        </Button>
      </div>
    </Dialog>
  )
}

export default ReleaseDialog
