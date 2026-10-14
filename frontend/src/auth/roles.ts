import type { CurrentUser } from './AuthContext'

// T#39 (D9): 인력 관리자 is an account with the HR_MANAGER role (hr.manager, dual.manager). Only it registers and edits
// employees and changes their status; the screen hides those controls for anyone else, and the server refuses them.
export function isHrManager(user: CurrentUser | null | undefined): boolean {
  return Boolean(user?.roles.includes('HR_MANAGER'))
}

// T#34 (D9): 프로젝트 관리자 is an account with the PROJECT_MANAGER role (project.manager, dual.manager). Only it registers
// and edits projects; the screen sends anyone else away from the forms, and the server refuses their writes.
export function isProjectManager(user: CurrentUser | null | undefined): boolean {
  return Boolean(user?.roles.includes('PROJECT_MANAGER'))
}
