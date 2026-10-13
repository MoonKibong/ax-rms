import { act } from '@testing-library/react'
import type { CurrentUser } from '../auth/AuthContext'

// Test helpers for T#6: fake fetch responses and the demo accounts (T#5 seed, T#6 contract table).
export const HR_MANAGER: CurrentUser = {
  username: 'hr.manager',
  employeeId: 3,
  employeeName: '이수민',
  roles: ['EMPLOYEE', 'HR_MANAGER'],
}

export const EMPLOYEE_ONLY: CurrentUser = {
  username: 'employee.demo',
  employeeId: 5,
  employeeName: '한지우',
  roles: ['EMPLOYEE'],
}

export const DUAL_MANAGER: CurrentUser = {
  username: 'dual.manager',
  employeeId: 6,
  employeeName: '오승현',
  roles: ['EMPLOYEE', 'HR_MANAGER', 'PROJECT_MANAGER'],
}

export function reply(status: number, body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response)
}

export function never(): Promise<Response> {
  return new Promise<Response>(() => undefined)
}

// Lets pending promises, state updates, and effects (including <Navigate>) finish.
export async function flush(): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}
