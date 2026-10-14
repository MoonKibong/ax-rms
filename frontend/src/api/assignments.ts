import { SAVE_FAILED, readFailure, type ApiFailure, type AvailabilityStatus } from './employees'

// T#17: the assignment API (T#10). The screen shows these values as they come (D36); it computes no availability.

// One row of GET /api/assignments/candidates: every employee, with the availability of the asked period (D18).
export type Candidate = {
  employeeId: number
  name: string
  availabilityStatus: AvailabilityStatus
  periodAvailability: number
}

// POST /api/assignments (201 answers the saved assignment).
export type AssignmentCreate = {
  employeeId: number
  projectId: number
  startDate: string
  endDate: string
  allocationPercent: number
}

// PATCH /api/assignments/{id}: only the values that changed.
export type AssignmentModify = Partial<Pick<AssignmentCreate, 'allocationPercent' | 'startDate' | 'endDate'>>

// Where a failed save is shown (contract "위반 메시지", BRIEF 6.7, D33): under the percent, under the period, or in the
// alert above the button.
export type FailureSpot = 'percent' | 'period' | 'form'

export type PlacedFailure = { spot: FailureSpot; message: string }

const PERCENT_CAUSES = ['ASSIGNMENT_INVALID_PERCENT', 'ASSIGNMENT_OVER_ALLOCATED']
const PERIOD_CAUSES = ['ASSIGNMENT_REQUEST_INVALID', 'ASSIGNMENT_OUT_OF_PROJECT_PERIOD']

// The server's own Korean message is shown as it is, but only an answer of this API ({code: ASSIGNMENT_…, message}) is
// trusted with a place; anything else (a network error, Spring's own body, a 500) is the generic "저장하지 못했습니다".
export function placeAssignmentFailure(failure: ApiFailure): PlacedFailure {
  const own = failure.code?.startsWith('ASSIGNMENT_') === true && failure.message !== undefined
  if (!own) {
    return { spot: 'form', message: SAVE_FAILED }
  }
  const message = failure.message as string
  if (PERCENT_CAUSES.includes(failure.code as string)) {
    return { spot: 'percent', message }
  }
  if (PERIOD_CAUSES.includes(failure.code as string)) {
    return { spot: 'period', message }
  }
  return { spot: 'form', message }
}

export type SendResult = { ok: true } | { ok: false; failure: PlacedFailure }

// POST, PATCH or DELETE of the assignment API. A network error or an answer the screen cannot place is a "form" failure.
export async function sendAssignment(method: 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<SendResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (response.ok) {
      // Read the body too: an unread body keeps the request open in the browser.
      await response.text().catch(() => '')
      return { ok: true }
    }
    return { ok: false, failure: placeAssignmentFailure(await readFailure(response)) }
  } catch {
    return { ok: false, failure: { spot: 'form', message: SAVE_FAILED } }
  }
}
