import type { EmployeeDetail } from '../api/employees'
import type { AuthState, CurrentUser } from '../auth/AuthContext'

// T#38 test helpers: employee details as GET /api/employees/{id} and GET /api/me/employee return them (T#8, T#28,
// with `today` from T#38), and a logged-in state for screens rendered without the login check.
export const PROJECT_MANAGER: CurrentUser = {
  username: 'project.manager',
  employeeId: 4,
  employeeName: '정하늘',
  roles: ['EMPLOYEE', 'PROJECT_MANAGER'],
}

export const PARK_DETAIL: EmployeeDetail = {
  id: 1,
  name: '박소영',
  departmentId: 1,
  departmentName: '개발팀',
  jobTitle: '백엔드 개발자',
  careerYears: 5,
  availabilityStatus: 'AVAILABLE',
  unavailableReason: null,
  unavailableUntil: null,
  currentAvailability: 40,
  needsReview: false,
  skills: [{ skillName: 'Java', proficiencyLevel: 'ADVANCED' }],
  assignments: [
    {
      projectId: 2,
      projectName: '감마 프로젝트',
      projectStatus: 'DONE',
      startDate: '2026-03-27',
      endDate: '2026-05-16',
      allocationPercent: 30,
    },
    {
      projectId: 1,
      projectName: '알파 프로젝트',
      projectStatus: 'IN_PROGRESS',
      startDate: '2026-09-23',
      endDate: '2026-11-22',
      allocationPercent: 60,
    },
  ],
  today: '2026-10-13',
}

export const CHOI_DETAIL: EmployeeDetail = {
  id: 2,
  name: '최동훈',
  departmentId: 1,
  departmentName: '개발팀',
  jobTitle: '프런트엔드 개발자',
  careerYears: 3,
  availabilityStatus: 'UNAVAILABLE',
  unavailableReason: '육아휴직',
  unavailableUntil: '2026-12-12',
  currentAvailability: 37,
  needsReview: true,
  skills: [{ skillName: 'React', proficiencyLevel: 'INTERMEDIATE' }],
  assignments: [
    {
      projectId: 3,
      projectName: '베타 프로젝트',
      projectStatus: 'IN_PROGRESS',
      startDate: '2026-10-03',
      endDate: '2026-11-12',
      allocationPercent: 40,
    },
  ],
  today: '2026-10-13',
}

export const LEE_DETAIL: EmployeeDetail = {
  id: 3,
  name: '이수민',
  departmentId: 2,
  departmentName: '기획팀',
  jobTitle: '인사 담당',
  careerYears: 7,
  availabilityStatus: 'AVAILABLE',
  unavailableReason: null,
  unavailableUntil: null,
  currentAvailability: 100,
  needsReview: false,
  skills: [],
  assignments: [],
  today: '2026-10-13',
}

export const HAN_DETAIL: EmployeeDetail = {
  id: 5,
  name: '한지우',
  departmentId: 1,
  departmentName: '개발팀',
  jobTitle: '개발자',
  careerYears: 2,
  availabilityStatus: 'AVAILABLE',
  unavailableReason: null,
  unavailableUntil: null,
  currentAvailability: 100,
  needsReview: false,
  skills: [{ skillName: 'Java', proficiencyLevel: 'BEGINNER' }],
  assignments: [],
  today: '2026-10-13',
}

// The value AuthProvider would give once GET /api/auth/me has answered with this user.
export function authAs(user: CurrentUser | null): AuthState {
  return {
    status: 'ready',
    user,
    signIn: () => undefined,
    logout: () => Promise.resolve(true),
    retry: () => undefined,
  }
}

// A response the test releases by hand, so it can prove the request was really held.
export function deferred() {
  let release: (response: Response) => void = () => undefined
  let released = false
  const promise = new Promise<Response>((resolve) => {
    release = (response) => {
      released = true
      resolve(response)
    }
  })
  return { promise, release, isReleased: () => released }
}
